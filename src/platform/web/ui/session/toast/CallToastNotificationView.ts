/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
