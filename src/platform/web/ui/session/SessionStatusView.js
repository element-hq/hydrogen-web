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

import {TemplateView} from "../general/TemplateView";
import {spinner} from "../common.js";

export class SessionStatusView extends TemplateView {
    render(t, vm) {
        return t.div({className: {
            "SessionStatusView": true,
            "hidden": vm => !vm.isShown,
        }}, [
            spinner(t, {hidden: vm => !vm.isWaiting}),
            t.p(vm => vm.statusLabel),
            t.if(vm => vm.isConnectNowShown, t => t.button({className: "link", onClick: () => vm.connectNow()}, "Retry now")),
            t.if(vm => vm.isSecretStorageShown, t => t.a({href: vm.setupKeyBackupUrl}, "Go to settings")),
            t.if(vm => vm.canDismiss, t => t.div({className: "end"}, t.button({className: "dismiss", onClick: () => vm.dismiss()}))),
        ]);
    }
}
