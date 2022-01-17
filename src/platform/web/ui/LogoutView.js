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
