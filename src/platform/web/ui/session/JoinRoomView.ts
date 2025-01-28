/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../general/TemplateView";
import type {JoinRoomViewModel} from "../../../../domain/session/JoinRoomViewModel";
import {spinner} from "../common.js";

export class JoinRoomView extends TemplateView<JoinRoomViewModel> {
    render(t, vm) {
        const input = t.input({
            type: "text",
            name: "id",
            id: "id",
            placeholder: vm.i18n`Enter a room id or alias`,
            disabled: vm => vm.joinInProgress,
        });
        return t.main({className: "JoinRoomView middle"}, [
            t.div({className: "JoinRoomView_header middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Cancel room join`}),
                t.h2("Join room"),
            ]),
            t.div({className: "JoinRoomView_body centered-column"}, [
                t.form({className: "JoinRoomView_detailsForm form", onSubmit: evt => this.onSubmit(evt,  input.value)}, [
                    t.div({className: "vertical-layout"}, [
                        t.div({className: "stretch form-row text"}, [
                            t.label({for: "id"}, vm.i18n`Room id`),
                            input,
                        ]),
                    ]),
                    t.div({className: "button-row"}, [
                        t.button({
                            className: "button-action primary",
                            type: "submit",
                            disabled: vm => vm.joinInProgress
                        }, vm.i18n`Join`),
                    ]),
                    t.map(vm => vm.status, (status, t) => {
                        return t.div({ className: "JoinRoomView_status" }, [
                            spinner(t, { hidden: vm => !vm.joinInProgress }),
                            t.span(status),
                        ]);
                    })
                ])
            ])
        ]);
    }

    onSubmit(evt, id) {
        evt.preventDefault();
        this.value.join(id);
    }
}
