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

import {TemplateView} from "../../../general/TemplateView";
import {VerificationCancelledViewModel} from "../../../../../../domain/session/verification/stages/VerificationCancelledViewModel";
import {CancelTypes} from "../../../../../../matrix/verification/SAS/channel/types";

export class VerificationCancelledView extends TemplateView<VerificationCancelledViewModel> {
    render(t, vm: VerificationCancelledViewModel) {
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

    getDescriptionFromCancellationCode(code: CancelTypes, isCancelledByUs: boolean): string {
        const descriptionsWhenWeCancelled = {
            // [CancelTypes.UserCancelled]: NO_NEED_FOR_DESCRIPTION_HERE
            [CancelTypes.InvalidMessage]: "You other device sent an invalid message.",
            [CancelTypes.KeyMismatch]: "The key could not be verified.",
            // [CancelTypes.OtherDeviceAccepted]: "Another device has accepted this request.",
            [CancelTypes.TimedOut]: "The verification process timed out.",
            [CancelTypes.UnexpectedMessage]: "Your other device sent an unexpected message.",
            [CancelTypes.UnknownMethod]: "Your other device is using an unknown method for verification.",
            [CancelTypes.UnknownTransaction]: "Your other device sent a message with an unknown transaction id.",
            [CancelTypes.UserMismatch]: "The expected user did not match the user verified.",
            [CancelTypes.MismatchedCommitment]: "The hash commitment does not match.",
            [CancelTypes.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        const descriptionsWhenTheyCancelled = {
            [CancelTypes.UserCancelled]: "Your other device cancelled the verification!",
            [CancelTypes.InvalidMessage]: "Invalid message sent to the other device.",
            [CancelTypes.KeyMismatch]: "The other device could not verify our keys",
            // [CancelTypes.OtherDeviceAccepted]: "Another device has accepted this request.",
            [CancelTypes.TimedOut]: "The verification process timed out.",
            [CancelTypes.UnexpectedMessage]: "Unexpected message sent to the other device.",
            [CancelTypes.UnknownMethod]: "Your other device does not understand the method you chose",
            [CancelTypes.UnknownTransaction]: "Your other device rejected our message.",
            [CancelTypes.UserMismatch]: "The expected user did not match the user verified.",
            [CancelTypes.MismatchedCommitment]: "Your other device was not able to verify the hash commitment",
            [CancelTypes.MismatchedSAS]: "The emoji/decimal did not match.",
        }
        const map = isCancelledByUs ? descriptionsWhenWeCancelled : descriptionsWhenTheyCancelled;
        return map[code] ?? "";
    }
}
