/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

    get otherUserId() {
        return this.getOption("sas").otherUserId;
    }

    get kind(): string {
        return "select-method";
    }

    get isCrossSigningAnotherUser(): boolean {
        return this.getOption("sas").isCrossSigningAnotherUser;
    }
}
