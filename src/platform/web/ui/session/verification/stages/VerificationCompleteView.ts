/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import type {VerificationCompleteViewModel} from "../../../../../../domain/session/verification/stages/VerificationCompleteViewModel";

export class VerificationCompleteView extends TemplateView<VerificationCompleteViewModel> {
    render(t: Builder<VerificationCompleteViewModel>, vm: VerificationCompleteViewModel) {
        return t.div({ className: "VerificationCompleteView" }, [
            t.div({className: "VerificationCompleteView__icon"}),
            t.div({ className: "VerificationCompleteView__heading" }, [
                t.h2(
                    { className: "VerificationCompleteView__title" },
                    vm.i18n`Verification completed successfully!`
                ),
            ]),
            t.p(
                { className: "VerificationCompleteView__description" }, vm.verificationSuccessfulMessage),
            t.div({ className: "VerificationCompleteView__actions" }, [
                t.button({
                    className: {
                        "button-action": true,
                        "primary": true,
                    },
                    onclick: () => vm.dismiss(),
                }, "Got it")
            ]),
        ]);
    }
}
