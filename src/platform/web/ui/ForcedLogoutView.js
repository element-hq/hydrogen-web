/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {TemplateView, InlineTemplateView} from "./general/TemplateView";

export class ForcedLogoutView extends TemplateView {
    render(t, vm) {
        const proceedView = new InlineTemplateView(vm, t => {
            return t.div([
                t.p("Your access token is no longer valid! You can reauthenticate in the next screen."),
                t.div({ className: "button-row" }, [
                    t.button({
                        className: "button-action primary",
                        type: "submit",
                        onClick: () => vm.proceed(),
                    }, vm.i18n`Proceed`)
                ]),
            ]);
        });
        const progressView = new InlineTemplateView(vm, t => {
            return t.p({className: "status"}, [ t.span(vm => vm.error) ]);
        });

        return t.div({className: "LogoutScreen"}, [
            t.div({className: "content"}, 
                t.mapView(vm => vm.error, error => {
                    return error? progressView: proceedView;
                })
            ),
        ]);
    }
}
