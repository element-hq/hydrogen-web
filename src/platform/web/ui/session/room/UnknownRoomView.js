/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
