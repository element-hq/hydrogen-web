/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import {VerificationCancelledViewModel} from "../../../../../../domain/session/verification/stages/VerificationCancelledViewModel";

export class VerificationCancelledView extends TemplateView<VerificationCancelledViewModel> {
    render(t: Builder<VerificationCancelledViewModel>, vm: VerificationCancelledViewModel) {
        return t.div(
            {
                className: "VerificationCancelledView",
            },
            [
                t.h2(
                    { className: "VerificationCancelledView__title" },
                    vm.title,
                ),
                t.p(
                    { className: "VerificationCancelledView__description" },
                   vm.description,
                ),
                t.div({ className: "VerificationCancelledView__actions" }, [
                    t.button({
                        className: {
                            "button-action": true,
                            "primary": true,
                        },
                        onclick: () => vm.dismiss(),
                    }, "Got it")
                ]),
            ]
        );
    }
}
