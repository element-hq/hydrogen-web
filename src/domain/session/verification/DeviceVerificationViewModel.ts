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
import type {Session} from "../../../matrix/Session.js";
import type {SASVerification} from "../../../matrix/verification/SAS/SASVerification";
import type {SASRequest} from "../../../matrix/verification/SAS/SASRequest";
import type {Room} from "../../../matrix/room/Room.js";

type Options = BaseOptions & {
    session: Session;
    request?: SASRequest;
    room?: Room;
    userId?: string;
};

export class DeviceVerificationViewModel extends ErrorReportViewModel<SegmentType, Options> {
    private sas: SASVerification;
    private _currentStageViewModel: any;

    constructor(options: Readonly<Options>) {
        super(options);
        this.init(options);
    }

    private async init(options: Options): Promise<void> {
        const room = options.room;
        let requestOrUserId: SASRequest | string;
        requestOrUserId =
            options.request ??
            options.userId ??
            this.getOption("session").userId;
        await this.start(requestOrUserId, room);
    }

    private async start(requestOrUserId: SASRequest | string, room?: Room) {
        await this.logAndCatch("DeviceVerificationViewModel.start", (log) => {
            const crossSigning = this.getOption("session").crossSigning.get();
            this.sas = crossSigning.startVerification(requestOrUserId, room, log);
            if (!this.sas) {
                throw new Error("CrossSigning.startVerification did not return a sas object!");
            }
            this.addEventListeners();
            if (typeof requestOrUserId === "string") {
                this.updateCurrentStageViewModel(new WaitingForOtherUserViewModel(this.childOptions({ sas: this.sas })));
            }
            return this.sas.verify();
            // return crossSigning.signDevice(this.sas, log);
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
        }));
    }

    private updateCurrentStageViewModel(vm) {
        this._currentStageViewModel = this.disposeTracked(this._currentStageViewModel);
        this._currentStageViewModel = this.track(vm);
        this.emitChange("currentStageViewModel");
    }

    dispose(): void {
        if (!this.sas.finished) {
            this.sas.abort().catch(() => {/** ignore */});
        }
        super.dispose();
    }

    get currentStageViewModel() {
        return this._currentStageViewModel;
    }

    get type(): string { 
        return "verification";
    }
}
