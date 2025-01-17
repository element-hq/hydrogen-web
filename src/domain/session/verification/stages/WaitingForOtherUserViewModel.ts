/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ViewModel, Options as BaseOptions} from "../../../ViewModel";
import {SegmentType} from "../../../navigation/index";
import type {SASVerification} from "../../../../matrix/verification/SAS/SASVerification";

type Options = BaseOptions & {
    sas: SASVerification;
};

export class WaitingForOtherUserViewModel extends ViewModel<SegmentType, Options> {
    async cancel() {
        await this.options.sas.abort();
    }

    get title() {
        const message = this.getOption("sas").isCrossSigningAnotherUser
            ? "Waiting for the other user to accept the verification request"
            : "Waiting for any of your device to accept the verification request";
        return this.i18n`${message}`;
    }

    get description() {
        const message = this.getOption("sas").isCrossSigningAnotherUser
            ? "Ask the other user to accept the request from their client!"
            : "Accept the request from the device you wish to verify!";
        return this.i18n`${message}`;
     }

    get kind(): string {
        return "waiting-for-user";
    }
}
