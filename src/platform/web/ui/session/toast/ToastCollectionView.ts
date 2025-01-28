/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {CallToastNotificationView} from "./CallToastNotificationView";
import {VerificationToastNotificationView} from "./VerificationToastNotificationView";
import {ListView} from "../../general/ListView";
import {TemplateView, Builder} from "../../general/TemplateView";
import type {IView} from "../../general/types";
import type {CallToastNotificationViewModel} from "../../../../../domain/session/toast/calls/CallToastNotificationViewModel";
import type {ToastCollectionViewModel} from "../../../../../domain/session/toast/ToastCollectionViewModel";
import type {BaseToastNotificationViewModel} from "../../../../../domain/session/toast/BaseToastNotificationViewModel";
import type {VerificationToastNotificationViewModel} from "../../../../../domain/session/toast/verification/VerificationToastNotificationViewModel";

function toastViewModelToView(vm: BaseToastNotificationViewModel): IView {
    switch (vm.kind) {
        case "calls":
            return new CallToastNotificationView(vm as CallToastNotificationViewModel); 
        case "verification":
            return new VerificationToastNotificationView(vm as VerificationToastNotificationViewModel);
        default:
            throw new Error(`Cannot find view class for notification kind ${vm.kind}`);
    }
}

export class ToastCollectionView extends TemplateView<ToastCollectionViewModel> {
    render(t: Builder<ToastCollectionViewModel>, vm: ToastCollectionViewModel) {
        return t.div({ className: "ToastCollectionView" }, [
            t.ifView(vm => !!vm.toastViewModels, t => {
                return new ListView({
                    list: vm.toastViewModels,
                    parentProvidesUpdates: false,
                }, (vm: CallToastNotificationViewModel) => toastViewModelToView(vm));
            }),
        ]);
    }
}
