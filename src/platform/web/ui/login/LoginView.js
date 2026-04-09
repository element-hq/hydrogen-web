/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../general/TemplateView";
import {hydrogenGithubLink} from "./common.js";
import {PasswordLoginView} from "./PasswordLoginView.js";
import {CompleteSSOView} from "./CompleteSSOView.js";
import {SessionLoadStatusView} from "./SessionLoadStatusView.js";
import {spinner} from "../common.js";

export class LoginView extends TemplateView {
    render(t, vm) {
        const disabled = vm => vm.isBusy;

        return t.div({className: "PreSessionScreen"}, [
            t.button({
                className: "button-utility LoginView_back",
                onClick: () => vm.goBack(),
                disabled
            }),
            t.div({className: "logo"}),
            t.div({className: "SessionLoginView"}, [
                t.h1([vm.i18n`Sign In`]),
                t.mapView(vm => vm.completeSSOLoginViewModel, vm => vm ? new CompleteSSOView(vm) : null),
                t.if(vm => vm.showHomeserver, (t, vm) => t.div({ className: "LoginView_sso form-row text" },
                    [
                        t.label({for: "homeserver"}, vm.i18n`Homeserver`),
                        t.input({
                            id: "homeserver",
                            type: "text",
                            placeholder: vm.i18n`Your matrix homeserver`,
                            value: vm.homeserver,
                            disabled,
                            onInput: event => vm.setHomeserver(event.target.value),
                            onChange: () => vm.queryHomeserver(),
                        }),
                        t.p({className: {
                            LoginView_forwardInfo: true,
                            hidden: vm => !vm.resolvedHomeserver
                        }}, vm => vm.i18n`You will connect to ${vm.resolvedHomeserver}.`),
                        t.if(vm => vm.errorMessage, (t, vm) => t.p({className: "error"}, vm.i18n(vm.errorMessage))),
                    ]
                )),
                t.if(vm => vm.isFetchingLoginOptions, t => t.div({className: "LoginView_query-spinner"}, [spinner(t), t.p("Fetching available login options...")])),
                t.mapView(vm => vm.passwordLoginViewModel, vm => vm ? new PasswordLoginView(vm): null),
                t.if(vm => vm.passwordLoginViewModel && vm.startSSOLoginViewModel, t => t.p({className: "LoginView_separator"}, vm.i18n`or`)),
                t.mapView(vm => vm.startSSOLoginViewModel, vm => vm ? new StartSSOLoginView(vm) : null),
                t.mapView(vm => vm.loadViewModel, loadViewModel => loadViewModel ? new SessionLoadStatusView(loadViewModel) : null),
                // use t.mapView rather than t.if to create a new view when the view model changes too
            ]), 
            t.p(hydrogenGithubLink(t))
        ]);
    }
}

class StartSSOLoginView extends TemplateView {
    render(t, vm) {
        return t.div({ className: "StartSSOLoginView" },
            t.button({
                className: "StartSSOLoginView_button button-action secondary",
                type: "button",
                onClick: () => vm.startSSOLogin(),
                disabled: vm => vm.isBusy
            }, vm.i18n`Log in with SSO`)
        );
    }
}
