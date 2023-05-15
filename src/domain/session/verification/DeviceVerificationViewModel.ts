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

type Options = BaseOptions & {
    session: Session;
    request: SASRequest;
};

export class DeviceVerificationViewModel extends ErrorReportViewModel<SegmentType, Options> {
    private sas: SASVerification;
    private _currentStageViewModel: any;

    constructor(options: Readonly<Options>) {
        super(options);
        const sasRequest = options.request;
        if (options.request) {
            this.start(sasRequest);
        }
        else {
            // We are about to send the request
            this.start(this.getOption("session").userId);
        }
    }

    private async start(requestOrUserId: SASRequest | string) {
        await this.logAndCatch("DeviceVerificationViewModel.start", (log) => {
            const crossSigning = this.getOption("session").crossSigning.get();
            this.sas = crossSigning.startVerification(requestOrUserId, log);
            this.addEventListeners();
            if (typeof requestOrUserId === "string") {
                this.updateCurrentStageViewModel(new WaitingForOtherUserViewModel(this.childOptions({ sas: this.sas })));
            }
            return this.sas.start();
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
                    this.childOptions({ cancellation: cancellation! })
                )
            );
        }));
        this.track(this.sas.disposableOn("VerificationCompleted", (deviceId) => {
            this.updateCurrentStageViewModel(
                new VerificationCompleteViewModel(this.childOptions({ deviceId: deviceId! }))
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
}
