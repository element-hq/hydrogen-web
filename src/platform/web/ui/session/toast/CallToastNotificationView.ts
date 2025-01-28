/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {AvatarView} from "../../AvatarView.js";
import {ErrorView} from "../../general/ErrorView";
import {TemplateView, Builder} from "../../general/TemplateView";
import type {CallToastNotificationViewModel} from "../../../../../domain/session/toast/calls/CallToastNotificationViewModel";

export class CallToastNotificationView extends TemplateView<CallToastNotificationViewModel> {
    render(t: Builder<CallToastNotificationViewModel>, vm: CallToastNotificationViewModel) {
        return t.div({ className: "CallToastNotificationView" }, [
            t.div({ className: "CallToastNotificationView__top" }, [
                t.view(new AvatarView(vm, 24)),
                t.span({ className: "CallToastNotificationView__name" }, (vm) => vm.roomName),
                t.button({
                    className: "button-action CallToastNotificationView__dismiss-btn",
                    onClick: () => vm.dismiss(),
                }),
            ]),
            t.div({ className: "CallToastNotificationView__description" }, [
                t.span(vm.i18n`Video call started`)
            ]),
            t.div({ className: "CallToastNotificationView__info" }, [
                t.span({className: "CallToastNotificationView__call-type"}, vm.i18n`Video`),
                t.span({className: "CallToastNotificationView__member-count"}, (vm) => vm.memberCount),
            ]),
            t.div({ className: "CallToastNotificationView__action" }, [
                t.button({
                    className: "button-action primary",
                    onClick: () => vm.join(),
                }, vm.i18n`Join`),
            ]),
            t.if(vm => !!vm.errorViewModel, t => {
                return t.div({className: "CallView_error"}, t.view(new ErrorView(vm.errorViewModel!)));
            }),
        ]);
    }
}
