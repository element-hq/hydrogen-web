/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
        return t.main({className: "middle"}, 
            t.div({className: "JoinRoomView centered-column"}, [
                t.h2("Join room"),
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
        );
    }

    onSubmit(evt, id) {
        evt.preventDefault();
        this.value.join(id);
    }
}

