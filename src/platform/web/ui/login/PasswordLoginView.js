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

import {TemplateView} from "../general/TemplateView.js";

export class PasswordLoginView extends TemplateView {
    render(t, vm) {
        const disabled = vm => !!vm.isBusy;
        const username = t.input({
            id: "username",
            type: "text",
            placeholder: vm.i18n`Username`,
            disabled
        });
        const password = t.input({
            id: "password",
            type: "password",
            placeholder: vm.i18n`Password`,
            disabled
        });
        
        return t.div({className: "PasswordLoginView form"}, [
            t.if(vm => vm.error, t => t.div({ className: "error" }, vm => vm.error)),
            t.form({
                onSubmit: evnt => {
                    evnt.preventDefault();
                    vm.login(username.value, password.value);
                }
            }, [
                t.if(vm => vm.errorMessage, (t, vm) => t.p({className: "error"}, vm.i18n(vm.errorMessage))),
                t.div({ className: "form-row" }, [t.label({ for: "username" }, vm.i18n`Username`), username]),
                t.div({ className: "form-row" }, [t.label({ for: "password" }, vm.i18n`Password`), password]),
                t.div({ className: "button-row" }, [
                    t.button({
                        className: "button-action primary",
                        type: "submit",
                        disabled
                    }, vm.i18n`Log In`),
                ]),
            ])
        ]);
    }
}

