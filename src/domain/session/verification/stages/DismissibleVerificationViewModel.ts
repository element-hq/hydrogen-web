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
