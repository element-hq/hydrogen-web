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

type Options = BaseOptions & {
    session: Session;
    sas: SASVerification;
};

export class DeviceVerificationViewModel extends ErrorReportViewModel<SegmentType, Options> {
    private session: Session;
    private sas: SASVerification;
    private _currentStageViewModel: any;

    constructor(options: Readonly<Options>) {
        super(options);
        this.session = options.session;
        const existingSas = this.session.crossSigning.receivedSASVerification.get();
        if (existingSas) {
            // SAS already created from request
            this.startWithExistingSAS(existingSas);
        }
        else {
            // We are about to send the request
            this.createAndStartSasVerification();
            this._currentStageViewModel = this.track(
                new WaitingForOtherUserViewModel(
                    this.childOptions({ sas: this.sas })
                )
            );
        }
    }

    private async startWithExistingSAS(sas: SASVerification) {
        await this.logAndCatch("DeviceVerificationViewModel.startWithExistingSAS", (log) => {
            this.sas = sas;
            this.hookToEvents();
            return this.sas.start();
        });
    }
    
    private async createAndStartSasVerification(): Promise<void> {
        await this.logAndCatch("DeviceVerificationViewModel.createAndStartSasVerification", (log) => {
            // todo: can crossSigning be undefined?
            const crossSigning = this.session.crossSigning;
            // todo: should be called createSasVerification
            this.sas = crossSigning.startVerification(this.session.userId, undefined, log);
            this.hookToEvents();
            return this.sas.start();
        });
    }

    private hookToEvents() {
        const emitter = this.sas.eventEmitter;
        this.track(emitter.disposableOn("SelectVerificationStage", (stage) => {
            this.createViewModelAndEmit(
                new SelectMethodViewModel(this.childOptions({ sas: this.sas, stage: stage!, }))
            );
            }));
        this.track(emitter.disposableOn("EmojiGenerated", (stage) => {
            this.createViewModelAndEmit(
                new VerifyEmojisViewModel(this.childOptions({ stage: stage!, }))
            );
        }));
        this.track(emitter.disposableOn("VerificationCancelled", (cancellation) => {
            this.createViewModelAndEmit(
                new VerificationCancelledViewModel(
                    this.childOptions({ cancellationCode: cancellation!.code, cancelledByUs: cancellation!.cancelledByUs, })
                ));
            }));
        this.track(emitter.disposableOn("VerificationCompleted", (deviceId) => {
            this.createViewModelAndEmit(
                new VerificationCompleteViewModel(this.childOptions({ deviceId: deviceId! }))
            );
        }));
    }

    private createViewModelAndEmit(vm) {
        this._currentStageViewModel = this.disposeTracked(this._currentStageViewModel);
        this._currentStageViewModel = this.track(vm);
        this.emitChange("currentStageViewModel");
    }

    get currentStageViewModel() {
        return this._currentStageViewModel;
    }
}
