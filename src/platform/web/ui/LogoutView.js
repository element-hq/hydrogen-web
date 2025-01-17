/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {TemplateView, InlineTemplateView} from "./general/TemplateView";
import {spinner} from "./common.js";

export class LogoutView extends TemplateView {
    render(t, vm) {
        const confirmView = new InlineTemplateView(vm, t => {
            return t.div([
                t.p("Are you sure you want to log out?"),
                t.div({ className: "button-row" }, [
                    t.a({
                        className: "button-action",
                        type: "submit",
                        href: vm.cancelUrl,
                    }, ["Cancel"]),
                    t.button({
                        className: "button-action primary destructive",
                        type: "submit",
                        onClick: () => vm.logout(),
                    }, vm.i18n`Log out`)
                ]),
            ]);
        });
        const progressView = new InlineTemplateView(vm, t => {
            return t.p({className: "status", hidden: vm => !vm.showStatus}, [
                spinner(t, {hidden: vm => !vm.busy}), t.span(vm => vm.status)
            ]);
        });

        return t.div({className: "LogoutScreen"}, [
            t.div({className: "content"}, [
                t.mapView(vm => vm.showConfirm, showConfirm => {
                    return showConfirm ? confirmView : progressView;
                })
            ]),
        ]);
    }
}
