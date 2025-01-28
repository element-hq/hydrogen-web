/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../general/TemplateView";

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
                t.div({ className: "form-row text" }, [t.label({ for: "username" }, vm.i18n`Username`), username]),
                t.div({ className: "form-row text" }, [t.label({ for: "password" }, vm.i18n`Password`), password]),
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

