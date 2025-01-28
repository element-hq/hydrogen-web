/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../../general/TemplateView";

export class UnknownRoomView extends TemplateView {
    render(t, vm) {
        return t.main({className: "UnknownRoomView middle"}, [
            t.div({className: "UnknownRoomView_header middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Cancel room join`}),
                t.h2("Join room"),
            ]),
            t.div({className: "UnknownRoomView_body centered-column"}, [
                t.div({className: "UnknownRoomView_container"}, [
                    t.h2([
                        vm.i18n`You are currently not in ${vm.roomIdOrAlias}.`,
                        t.br(),
                        vm.i18n`Want to join it?`
                    ]),
                    t.button({
                        className: "button-action primary",
                        onClick: () => vm.join(),
                        disabled: vm => vm.busy,
                    }, vm.i18n`Join room`),
                    t.if(vm => vm.error, t => t.p({className: "error"}, vm.error))
                ])
            ])
        ]);
    }
}
