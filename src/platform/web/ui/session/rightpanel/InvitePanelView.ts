/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Builder, TemplateView} from "../../general/TemplateView";
import {ErrorView} from "../../general/ErrorView";
import type {InvitePanelViewModel} from "../../../../../domain/session/rightpanel/InvitePanelViewModel";

export class InvitePanelView extends TemplateView<InvitePanelViewModel> {
    render(t: Builder<InvitePanelViewModel>, vm: InvitePanelViewModel) {
        const input = t.input({
            className: "InvitePanelView__input",
            type: "text",
            placeholder: "Enter user-id of user",
            onkeydown: (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    vm.invite((input as HTMLInputElement).value);
                }
            }
        });
        return t.div({ className: "InvitePanelView" }, [
            t.h3({ className: "InvitePanelView__heading" },
                (vm: InvitePanelViewModel) => vm.i18n`Invite to ${vm.roomName}`
            ),
            t.div({ className: "InvitePanelView__form" }, [
                input,
                t.button({
                    className: "InvitePanelView__btn button-action primary",
                    onClick: () => vm.invite((input as HTMLInputElement).value),
                }, "Invite"),
            ]),
            t.div({ className: "InvitePanelView__error" }, [
                t.ifView(vm => !!vm.errorViewModel, vm => new ErrorView(vm.errorViewModel!)),
            ]),
        ]);
    }

}
