/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView} from "../general/TemplateView";
import {spinner} from "../common.js";
import {AccountSetupView} from "./AccountSetupView.js";

/** a view used both in the login view and the loading screen
to show the current state of loading the session.
Just a spinner and a label, meant to be used as a paragraph */
export class SessionLoadStatusView extends TemplateView {
    render(t) {
        const exportLogsButtonIfFailed = t.if(vm => vm.hasError, (t, vm) => {
            return t.button({
                onClick: () => vm.exportLogs()
            }, vm.i18n`Export logs`);
        });
        const logoutButtonIfFailed = t.if(vm => vm.hasError, (t, vm) => {
            return t.button({
                onClick: () => vm.logout()
            }, vm.i18n`Log out`);
        });
        return t.div({className: "SessionLoadStatusView"}, [
            t.p({className: "status"}, [
                spinner(t, {hidden: vm => !vm.loading}),
                t.p(vm => vm.loadLabel),
                exportLogsButtonIfFailed,
                logoutButtonIfFailed
            ]),
            t.ifView(vm => vm.accountSetupViewModel, vm => new AccountSetupView(vm.accountSetupViewModel)),
        ]);
    }
}
