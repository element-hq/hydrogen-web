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
