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
