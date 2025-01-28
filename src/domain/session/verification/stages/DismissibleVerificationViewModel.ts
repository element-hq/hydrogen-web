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

type Options = BaseOptions & {
    sas: SASVerification;
    session: Session;
};

export abstract class DismissibleVerificationViewModel<O extends Options> extends ErrorReportViewModel<SegmentType, O> {
    dismiss(): void {
        /**
         * If we're cross-signing another user, redirect to the room (which will just close the right panel).
         * If we're verifying a device, redirect to settings.
         */
        if (this.getOption("sas").isCrossSigningAnotherUser) {
            const path = this.navigation.path.until("room");
            this.navigation.applyPath(path);
        } else {
            this.navigation.push("settings", true);
        }
    }
}
