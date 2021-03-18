/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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
import {hydrogenGithubLink} from "./common.js";
import {SessionLoadStatusView} from "./SessionLoadStatusView.js";

export class LoginView extends TemplateView {
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
        const homeserver = t.input({
            id: "homeserver",
            type: "url",
            placeholder: vm.i18n`Your matrix homeserver`,
            value: vm.defaultHomeServer, 
            disabled
        });
        
        return t.div({className: "PreSessionScreen"}, [
            t.div({className: "logo"}),
            t.div({className: "LoginView form"}, [
                t.h1([vm.i18n`Sign In`]),
                t.if(vm => vm.error, t => t.div({className: "error"}, vm => vm.error)),
                t.form({
                    onSubmit: evnt => {
                        evnt.preventDefault();
                        vm.login(username.value, password.value, homeserver.value);
                    }
                }, [
                    t.div({className: "form-row"}, [t.label({for: "username"}, vm.i18n`Username`), username]),
                    t.div({className: "form-row"}, [t.label({for: "password"}, vm.i18n`Password`), password]),
                    t.div({className: "form-row"}, [t.label({for: "homeserver"}, vm.i18n`Homeserver`), homeserver]),
                    t.mapView(vm => vm.loadViewModel, loadViewModel => loadViewModel ? new SessionLoadStatusView(loadViewModel) : null),
                    t.div({className: "button-row"}, [
                        t.a({
                            className: "button-action secondary",
                            href: vm.cancelUrl
                        }, [vm.i18n`Go Back`]),
                        t.button({
                            className: "button-action primary",
                            type: "submit"
                        }, vm.i18n`Log In`),
                    ]),
                ]),
                // use t.mapView rather than t.if to create a new view when the view model changes too
                t.p(hydrogenGithubLink(t))
            ])
        ]);
    }
}

