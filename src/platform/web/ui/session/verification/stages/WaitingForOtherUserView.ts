/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../../general/TemplateView";
import {spinner} from "../../../common.js";
import {WaitingForOtherUserViewModel} from "../../../../../../domain/session/verification/stages/WaitingForOtherUserViewModel";

export class WaitingForOtherUserView extends TemplateView<WaitingForOtherUserViewModel> {
    render(t: Builder<WaitingForOtherUserViewModel>, vm: WaitingForOtherUserViewModel) {
        return t.div({ className: "WaitingForOtherUserView" }, [
            t.div({ className: "WaitingForOtherUserView__heading" }, [
                spinner(t),
                t.h2(
                    { className: "WaitingForOtherUserView__title" },
                    vm.title,
                ),
            ]),
            t.p({ className: "WaitingForOtherUserView__description" },
                vm.description,
            ),
            t.div({ className: "WaitingForOtherUserView__actions" },
                t.button({
                    className: {
                        "button-action": true,
                        "primary": true,
                        "destructive": true,
                    },
                    onclick: () => vm.cancel(),
                }, "Cancel")
            ),
        ]);
    }
}
