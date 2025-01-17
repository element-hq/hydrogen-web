/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {DismissibleVerificationViewModel} from "./DismissibleVerificationViewModel";
import type {Options as BaseOptions} from "../../../ViewModel";
import type {Session} from "../../../../matrix/Session.js";
import type {SASVerification} from "../../../../matrix/verification/SAS/SASVerification";

type Options = BaseOptions & {
    deviceId: string;
    session: Session;
    sas: SASVerification;
};

export class VerificationCompleteViewModel extends DismissibleVerificationViewModel<Options> {
    get otherDeviceId(): string {
        return this.options.deviceId;
    }

    get otherUsername(): string {
        return this.getOption("sas").otherUserId;
    }

    get kind(): string {
        return "verification-completed";
    }

    get verificationSuccessfulMessage(): string {
        if (this.getOption("sas").isCrossSigningAnotherUser) {
            return this.i18n`You successfully verified user ${this.otherUsername}`;
        }
        else {
            return this.i18n`You successfully verified device ${this.otherDeviceId}`;
        }
    }
}
