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
