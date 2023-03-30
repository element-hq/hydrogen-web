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
import {TemplateView, Builder} from "../../general/TemplateView";
import type {VerificationToastNotificationViewModel} from "../../../../../domain/session/toast/verification/VerificationToastNotificationViewModel";

export class VerificationToastNotificationView extends TemplateView<VerificationToastNotificationViewModel> {
    render(t: Builder<VerificationToastNotificationViewModel>, vm: VerificationToastNotificationViewModel) {
        return t.div({ className: "VerificationToastNotificationView" }, [
            t.div({ className: "VerificationToastNotificationView__top" }, [
                t.span({ className: "VerificationToastNotificationView__title" },
                    vm.i18n`Device Verification`),
                t.button({
                    className: "button-action VerificationToastNotificationView__dismiss-btn",
                    onClick: () => vm.dismiss(),
                }),
            ]),
            t.div({ className: "VerificationToastNotificationView__description" }, [
                t.span(vm.i18n`Do you want to verify device ${vm.otherDeviceId}?`),
            ]),
            t.div({ className: "VerificationToastNotificationView__action" }, [
                t.button({
                    className: "button-action primary destructive",
                    onClick: () => vm.dismiss(),
                }, vm.i18n`Ignore`),
                t.button({
                    className: "button-action primary",
                    onClick: () => vm.accept(),
                }, vm.i18n`Accept`),
            ]),
        ]);
    }
}
