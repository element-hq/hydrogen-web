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

import {TemplateView} from "./general/TemplateView";
import {spinner} from "./common.js";

export class ForcedLogoutView extends TemplateView {
    render(t) {
        return t.div({ className: "LogoutScreen" }, [
            t.div({ className: "content" },
                t.map(vm => vm.showStatus, (showStatus, t, vm) => {
                    if (showStatus) {
                        return t.p({ className: "status" }, [
                            spinner(t, { hidden: vm => !vm.showSpinner }),
                            t.span(vm => vm.status)
                        ]);
                    }
                    else {
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
                    }
                })
            ),
        ]);
    }
}
