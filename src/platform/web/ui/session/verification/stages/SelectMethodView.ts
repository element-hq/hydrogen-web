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

import {Builder, TemplateView} from "../../../general/TemplateView";
import {spinner} from "../../../common.js"
import type {SelectMethodViewModel} from "../../../../../../domain/session/verification/stages/SelectMethodViewModel";

export class SelectMethodView extends TemplateView<SelectMethodViewModel> {
    render(t: Builder<SelectMethodViewModel>) {
        return t.div({ className: "SelectMethodView" }, [
            t.map(vm => vm.hasProceeded, (hasProceeded, t, vm) => {
                if (hasProceeded) {
                    return spinner(t);
                }
                else return t.div([
                    t.div({ className: "SelectMethodView__heading" }, [
                        t.h2( { className: "SelectMethodView__title" }, vm.i18n`Verify device '${vm.deviceName}' by comparing emojis?`),
                    ]),
                    t.p({ className: "SelectMethodView__description" },
                        vm.i18n`You are about to verify your other device by comparing emojis.`
                    ),
                    t.div({ className: "SelectMethodView__actions" }, [
                        t.button(
                            {
                                className: {
                                    "button-action": true,
                                    primary: true,
                                    destructive: true,
                                },
                                onclick: () => vm.cancel(),
                            },
                            "Cancel"
                        ),
                        t.button(
                            {
                                className: {
                                    "button-action": true,
                                    primary: true,
                                },
                                onclick: () => vm.proceed(),
                            },
                            "Proceed"
                        ),
                    ]),
                ]);
            }),
        ]);
    }
}
