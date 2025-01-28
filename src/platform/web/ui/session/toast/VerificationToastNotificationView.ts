/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
