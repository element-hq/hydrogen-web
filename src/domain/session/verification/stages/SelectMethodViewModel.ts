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

import {SegmentType} from "../../../navigation/index";
import {ErrorReportViewModel} from "../../../ErrorReportViewModel";
import type {Options as BaseOptions} from "../../../ViewModel";
import type {Session} from "../../../../matrix/Session.js";
import type {SASVerification} from "../../../../matrix/verification/SAS/SASVerification";
import type {SelectVerificationMethodStage} from "../../../../matrix/verification/SAS/stages/SelectVerificationMethodStage";

type Options = BaseOptions & {
    sas: SASVerification;
    stage: SelectVerificationMethodStage;
    session: Session;
};

export class SelectMethodViewModel extends ErrorReportViewModel<SegmentType, Options> {
    public hasProceeded: boolean = false;

    async proceed() {
        await this.logAndCatch("SelectMethodViewModel.proceed", async (log) => {
            await this.options.stage.selectEmojiMethod(log);
            this.hasProceeded = true;
            this.emitChange("hasProceeded");
        });
    }

    async cancel() {
        await this.logAndCatch("SelectMethodViewModel.cancel", async () => {
            await this.options.sas.abort();
        });
    }

    get deviceName() {
        return this.options.stage.otherDeviceName;
    }

    get kind(): string {
        return "select-method";
    }
}
