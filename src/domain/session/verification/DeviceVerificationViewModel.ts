/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {Options as BaseOptions} from "../../ViewModel";
import {SegmentType} from "../../navigation/index";
import {ErrorReportViewModel} from "../../ErrorReportViewModel";
import {WaitingForOtherUserViewModel} from "./stages/WaitingForOtherUserViewModel";
import {VerificationCancelledViewModel} from "./stages/VerificationCancelledViewModel";
import {SelectMethodViewModel} from "./stages/SelectMethodViewModel";
import {VerifyEmojisViewModel} from "./stages/VerifyEmojisViewModel";
import {VerificationCompleteViewModel} from "./stages/VerificationCompleteViewModel";
import {MissingKeysViewModel} from "./stages/MissingKeysViewModel";
import type {Session} from "../../../matrix/Session.js";
import type {SASVerification} from "../../../matrix/verification/SAS/SASVerification";
import type {SASRequest} from "../../../matrix/verification/SAS/SASRequest";
import type {CrossSigning} from "../../../matrix/verification/CrossSigning";
import type {ILogItem} from "../../../logging/types";
import type {Room} from "../../../matrix/room/Room.js";

type Options = BaseOptions & {
    session: Session;
    request?: SASRequest;
    room?: Room;
    userId?: string;
};

const neededSecrets = [
    "m.cross_signing.master",
    "m.cross_signing.self_signing",
    "m.cross_signing.user_signing",
];

export class DeviceVerificationViewModel extends ErrorReportViewModel<SegmentType, Options> {
    private sas: SASVerification;
    private _currentStageViewModel: any;
    private _needsToRequestSecret: boolean;

    constructor(options: Readonly<Options>) {
        super(options);
        this.start(options);
    }

    private async start(options: Options): Promise<void> {
        const room = options.room;
        let requestOrUserId: SASRequest | string;
        requestOrUserId =
            options.request ??
            options.userId ??
            this.getOption("session").userId;
        await this.startVerification(requestOrUserId, room);
    }

    private async startVerification(requestOrUserId: SASRequest | string, room?: Room) {
        await this.logAndCatch("DeviceVerificationViewModel.startVerification", async (log) => {
            const crossSigningObservable = this.getOption("session").crossSigning;
            const crossSigning = await crossSigningObservable.waitFor(c => !!c).promise;
            this.sas = crossSigning.startVerification(requestOrUserId, room, log);
            if (!this.sas) {
                throw new Error("CrossSigning.startVerification did not return a sas object!");
            }
            if (!await this.performPreVerificationChecks(crossSigning, requestOrUserId, log)) {
                return;
            }
            this.addEventListeners();
            if (typeof requestOrUserId === "string") {
                this.updateCurrentStageViewModel(new WaitingForOtherUserViewModel(this.childOptions({ sas: this.sas })));
            }
            if (this.sas.isCrossSigningAnotherUser) {
                return crossSigning.signUser(this.sas, log);
            }
            else {
                return crossSigning.signDevice(this.sas, log);
            }
        });
    }

    private async performPreVerificationChecks(crossSigning: CrossSigning, requestOrUserId: SASRequest | string, log: ILogItem): Promise<boolean> {
        return await log.wrap("DeviceVerificationViewModel.performPreVerificationChecks", async (_log) => {
            const areWeVerified = await crossSigning.areWeVerified(log);
            // If we're not verified, we'll need to ask the other device for secrets later
            const otherUserId = typeof requestOrUserId === "string" ? requestOrUserId : requestOrUserId.sender;
            const isDeviceVerification = otherUserId === this.getOption("session").userId;
            this._needsToRequestSecret =  isDeviceVerification && !areWeVerified;
            if (this._needsToRequestSecret) {
                return true;
            }
            /**
             * It's possible that we are verified but don't have access
             * to the private cross-signing keys. In this case we really
             * can't verify the other device because we need these keys
             * to sign their device. 
             * 
             * If this happens, we'll simply ask the user to enable key-backup
             * (and secret storage) and try again later.
             */
            const session = this.getOption("session");
            const promises = neededSecrets.map(s => session.secretFetcher.getSecret(s));
            const secrets = await Promise.all(promises)
            for (const secret of secrets) {
                if (!secret) {
                    // We really can't proceed!
                    this.updateCurrentStageViewModel(new MissingKeysViewModel(this.childOptions({})));
                    return false;
                }
            }
            return true;
        });
    }
    
    private addEventListeners() {
        this.track(this.sas.disposableOn("SelectVerificationStage", (stage) => {
            this.updateCurrentStageViewModel(
                new SelectMethodViewModel(this.childOptions({ sas: this.sas, stage: stage!, }))
            );
            }));
        this.track(this.sas.disposableOn("EmojiGenerated", (stage) => {
            this.updateCurrentStageViewModel(
                new VerifyEmojisViewModel(this.childOptions({ stage: stage!, }))
            );
        }));
        this.track(this.sas.disposableOn("VerificationCancelled", (cancellation) => {
            this.updateCurrentStageViewModel(
                new VerificationCancelledViewModel(
                    this.childOptions({ cancellation: cancellation!, sas: this.sas })
                )
            );
        }));
        this.track(this.sas.disposableOn("VerificationCompleted", (deviceId) => {
            this.updateCurrentStageViewModel(
                new VerificationCompleteViewModel(this.childOptions({ deviceId: deviceId!, sas: this.sas }))
            );
            this.requestSecrets();
        }));
    }

    private async requestSecrets() {
        await this.platform.logger.run("DeviceVerificationViewModel.requestSecrets", async (log) => {
            if (this._needsToRequestSecret) {
                const secretSharing = this.getOption("session").secretSharing;
                const requestPromises = neededSecrets.map((secret) => secretSharing.requestSecret(secret, log));
                const secretRequests = await Promise.all(requestPromises);
                const receivedSecretPromises = secretRequests.map(r => r.waitForResponse());
                await Promise.all(receivedSecretPromises);
                const crossSigning = this.getOption("session").crossSigning.get();
                crossSigning.start(log);
            }
        });
    }

    private updateCurrentStageViewModel(vm) {
        this._currentStageViewModel = this.disposeTracked(this._currentStageViewModel);
        this._currentStageViewModel = this.track(vm);
        this.emitChange("currentStageViewModel");
    }

    dispose(): void {
        if (this.sas && !this.sas.finished) {
            this.sas.abort().catch((e) => { console.error(e); });
        }
        super.dispose();
    }

    get currentStageViewModel() {
        return this._currentStageViewModel;
    }

    get type(): string { 
        return "verification";
    }

    get isHappeningInRoom(): boolean {
        return !!this.navigation.path.get("room");
    }
}
