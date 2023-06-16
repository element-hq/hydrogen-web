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

import {Options as BaseOptions} from "../../../ViewModel";
import {DismissibleVerificationViewModel} from "./DismissibleVerificationViewModel";
import {CancelReason} from "../../../../matrix/verification/SAS/channel/types";
import type {Session} from "../../../../matrix/Session.js";
import type {IChannel} from "../../../../matrix/verification/SAS/channel/IChannel";
import type {SASVerification} from "../../../../matrix/verification/SAS/SASVerification";

type Options = BaseOptions & {
    cancellation: IChannel["cancellation"];
    session: Session;
    sas: SASVerification; 
};

export class VerificationCancelledViewModel extends DismissibleVerificationViewModel<Options> {
    get cancelCode(): CancelReason {
        return this.options.cancellation!.code;
    }

    get isCancelledByUs(): boolean {
        return this.options.cancellation!.cancelledByUs;
    }

    get kind(): string {
        return "verification-cancelled";
    }

    get title(): string {
        if (this.isCancelledByUs) {
            return this.i18n`You cancelled the verification!`;
        }
        if (this.getOption("sas").isCrossSigningAnotherUser) {
            return this.i18n`The other user cancelled the verification!`;
        }
        else {
            return this.i18n`The other device cancelled the verification!`;
        }
    }

    get description(): string {
        const descriptionsWhenWeCancelledForDeviceVerification = {
            [CancelReason.InvalidMessage]: "Your other device sent an invalid message.",
            [CancelReason.KeyMismatch]: "The key could not be verified.",
            [CancelReason.TimedOut]: "The verification process timed out.",
            [CancelReason.UnexpectedMessage]: "Your other device sent an unexpected message.",
            [CancelReason.UnknownMethod]: "Your other device is using an unknown method for verification.",
            [CancelReason.UnknownTransaction]: "Your other device sent a message with an unknown transaction id.",
            [CancelReason.UserMismatch]: "The expected user did not match the user verified.",
            [CancelReason.MismatchedCommitment]: "The hash commitment does not match.",
            [CancelReason.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        const descriptionsWhenTheyCancelledForDeviceVerification = {
            [CancelReason.UserCancelled]: "Your other device cancelled the verification!",
            [CancelReason.InvalidMessage]: "Invalid message sent to the other device.",
            [CancelReason.KeyMismatch]: "The other device could not verify our keys",
            [CancelReason.TimedOut]: "The verification process timed out.",
            [CancelReason.UnexpectedMessage]: "Unexpected message sent to the other device.",
            [CancelReason.UnknownMethod]: "Your other device does not understand the method you chose",
            [CancelReason.UnknownTransaction]: "Your other device rejected our message.",
            [CancelReason.UserMismatch]: "The expected user did not match the user verified.",
            [CancelReason.MismatchedCommitment]: "Your other device was not able to verify the hash commitment",
            [CancelReason.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        const descriptionsWhenWeCancelledForCrossSigning = {
            [CancelReason.InvalidMessage]: "The other user sent an invalid message.",
            [CancelReason.KeyMismatch]: "The key could not be verified.",
            [CancelReason.TimedOut]: "The verification process timed out.",
            [CancelReason.UnexpectedMessage]: "The other user sent an unexpected message.",
            [CancelReason.UnknownMethod]: "The other user is using an unknown method for verification.",
            [CancelReason.UnknownTransaction]: "The other user sent a message with an unknown transaction id.",
            [CancelReason.UserMismatch]: "The expected user did not match the user verified.",
            [CancelReason.MismatchedCommitment]: "The hash commitment does not match.",
            [CancelReason.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        const descriptionsWhenTheyCancelledForCrossSigning = {
            [CancelReason.UserCancelled]: "The other user cancelled the verification!",
            [CancelReason.InvalidMessage]: "Invalid message sent to the other user.",
            [CancelReason.KeyMismatch]: "The other user could not verify our keys",
            [CancelReason.TimedOut]: "The verification process timed out.",
            [CancelReason.UnexpectedMessage]: "Unexpected message sent to the other user.",
            [CancelReason.UnknownMethod]: "The other user does not understand the method you chose",
            [CancelReason.UnknownTransaction]: "The other user rejected our message.",
            [CancelReason.UserMismatch]: "The expected user did not match the user verified.",
            [CancelReason.MismatchedCommitment]: "The other user was not able to verify the hash commitment",
            [CancelReason.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        let map;
        if (this.getOption("sas").isCrossSigningAnotherUser) {
            map = this.isCancelledByUs ? descriptionsWhenWeCancelledForCrossSigning : descriptionsWhenTheyCancelledForCrossSigning;
        } else {
            map = this.isCancelledByUs ? descriptionsWhenWeCancelledForDeviceVerification : descriptionsWhenTheyCancelledForDeviceVerification;
        }
        const description = map[this.cancelCode] ?? ""
        return this.i18n`${description}`;
        
    }
}
