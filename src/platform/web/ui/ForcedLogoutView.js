/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
