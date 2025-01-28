/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
