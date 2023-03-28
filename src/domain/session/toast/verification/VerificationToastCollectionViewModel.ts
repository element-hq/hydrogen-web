
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

import {VerificationToastNotificationViewModel} from "./VerificationToastNotificationViewModel";
import {ObservableArray} from "../../../../observable";
import {ViewModel, Options as BaseOptions} from "../../../ViewModel";
import type {Session} from "../../../../matrix/Session.js";
import type {SegmentType} from "../../../navigation";
import type {IToastCollection} from "../IToastCollection";
import type {SASRequest} from "../../../../matrix/verification/SAS/SASRequest";

type Options = {
    session: Session;
} & BaseOptions;

export class VerificationToastCollectionViewModel extends ViewModel<SegmentType, Options> implements IToastCollection {
    public readonly toastViewModels: ObservableArray<VerificationToastNotificationViewModel> = new ObservableArray();

    constructor(options: Options) {
        super(options);
        this.subscribeToSASRequests();
    }

    private async subscribeToSASRequests() {
        await this.getOption("session").crossSigning.waitFor(v => !!v).promise; 
        const crossSigning = this.getOption("session").crossSigning.get();
        this.track(crossSigning.receivedSASVerifications.subscribe(this));
    }


    async onAdd(_, request: SASRequest) {
        const dismiss = () => {
            const idx = this.toastViewModels.array.findIndex(vm => vm.request.id === request.id);
            if (idx !== -1) {
                this.toastViewModels.remove(idx);
            }
        };
        this.toastViewModels.append(
            this.track(new VerificationToastNotificationViewModel(this.childOptions({ request, dismiss })))
        );
    }

    onRemove(_, request: SASRequest) {
        const idx = this.toastViewModels.array.findIndex(vm => vm.request.id === request.id);
        if (idx !== -1) {
            this.toastViewModels.remove(idx);
        }
    }

    onUpdate(_, request: SASRequest) {
        const idx = this.toastViewModels.array.findIndex(vm => vm.request.id === request.id);
        if (idx !== -1) {
            this.toastViewModels.update(idx, this.toastViewModels.at(idx)!);
        }
    }

    onReset() {
        for (let i = 0; i < this.toastViewModels.length; ++i) {
            this.toastViewModels.remove(i);
        }
    }
}
