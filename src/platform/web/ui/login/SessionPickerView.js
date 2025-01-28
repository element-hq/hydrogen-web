/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ListView} from "../general/ListView";
import {TemplateView} from "../general/TemplateView";
import {hydrogenGithubLink} from "./common.js";
import {SessionLoadStatusView} from "./SessionLoadStatusView.js";

class SessionPickerItemView extends TemplateView {
    _onDeleteClick() {
        if (confirm("Are you sure?")) {
            this.value.delete();
        }
    }

    _onClearClick() {
        if (confirm("Are you sure?")) {
            this.value.clear();
        }
    }

    render(t, vm) {
        return t.li([
            t.a({className: "session-info", href: vm.openUrl}, [
                t.div({className: `avatar usercolor${vm.avatarColorNumber}`}, vm => vm.avatarInitials),
                t.div({className: "user-id"}, vm => vm.label),
            ])
        ]);
    }
}

export class SessionPickerView extends TemplateView {
    render(t, vm) {
        const sessionList = new ListView({
            list: vm.sessions,
            parentProvidesUpdates: false,
        }, sessionInfo => {
            return new SessionPickerItemView(sessionInfo);
        });

        return t.div({className: "PreSessionScreen"}, [
            t.div({className: "logo"}),
            t.div({className: "SessionPickerView"}, [
                t.h1(["Continue as …"]),
                t.view(sessionList),
                t.div({className: "button-row"}, [
                    t.a({
                        className: "button-action primary",
                        href: vm.cancelUrl
                    }, vm.i18n`Sign In`)
                ]),
                t.ifView(vm => vm.loadViewModel, () => new SessionLoadStatusView(vm.loadViewModel)),
                t.p(hydrogenGithubLink(t))
            ])
        ]);
    }
}
