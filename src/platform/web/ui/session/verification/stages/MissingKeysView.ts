/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import type {MissingKeysViewModel} from "../../../../../../domain/session/verification/stages/MissingKeysViewModel";

export class MissingKeysView extends TemplateView<MissingKeysViewModel> {
    render(t: Builder<MissingKeysViewModel>, vm: MissingKeysViewModel) {
        return t.div(
            {
                className: "MissingKeysView",
            },
            [
                t.h2(
                    { className: "MissingKeysView__heading" },
                    vm.i18n`Verification is currently not possible!`
                ),
                t.p(
                    { className: "MissingKeysView__description" },
                   vm.i18n`Some keys needed for verification are missing. You can fix this by enabling key backup in settings.` 
                ),
                t.div({ className: "MissingKeysView__actions" }, [
                    t.button({
                        className: {
                            "button-action": true,
                            "primary": true,
                        },
                        onclick: () => vm.gotoSettings(),
                    }, "Open Settings")
                ]),
            ]
        );
    }
}
