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

import {Builder, TemplateView} from "../../../general/TemplateView";
import {VerificationCancelledViewModel} from "../../../../../../domain/session/verification/stages/VerificationCancelledViewModel";
import {CancelReason} from "../../../../../../matrix/verification/SAS/channel/types";

export class VerificationCancelledView extends TemplateView<VerificationCancelledViewModel> {
    render(t: Builder<VerificationCancelledViewModel>, vm: VerificationCancelledViewModel) {
        const headerTextStart = vm.isCancelledByUs ? "You" : "The other device";

        return t.div(
            {
                className: "VerificationCancelledView",
            },
            [
                t.h2(
                    { className: "VerificationCancelledView__title" },
                    vm.i18n`${headerTextStart} cancelled the verification!`
                ),
                t.p(
                    { className: "VerificationCancelledView__description" },
                   vm.i18n`${this.getDescriptionFromCancellationCode(vm.cancelCode, vm.isCancelledByUs)}` 
                ),
                t.div({ className: "VerificationCancelledView__actions" }, [
                    t.button({
                        className: {
                            "button-action": true,
                            "primary": true,
                        },
                        onclick: () => vm.gotoSettings(),
                    }, "Got it")
                ]),
            ]
        );
    }

    getDescriptionFromCancellationCode(code: CancelReason, isCancelledByUs: boolean): string {
        const descriptionsWhenWeCancelled = {
            [CancelReason.InvalidMessage]: "You other device sent an invalid message.",
            [CancelReason.KeyMismatch]: "The key could not be verified.",
            [CancelReason.TimedOut]: "The verification process timed out.",
            [CancelReason.UnexpectedMessage]: "Your other device sent an unexpected message.",
            [CancelReason.UnknownMethod]: "Your other device is using an unknown method for verification.",
            [CancelReason.UnknownTransaction]: "Your other device sent a message with an unknown transaction id.",
            [CancelReason.UserMismatch]: "The expected user did not match the user verified.",
            [CancelReason.MismatchedCommitment]: "The hash commitment does not match.",
            [CancelReason.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        const descriptionsWhenTheyCancelled = {
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
        const map = isCancelledByUs ? descriptionsWhenWeCancelled : descriptionsWhenTheyCancelled;
        return map[code] ?? "";
    }
}
