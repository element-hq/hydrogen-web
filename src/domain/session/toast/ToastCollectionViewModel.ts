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

import {ConcatList} from "../../../observable";
import {ViewModel, Options as BaseOptions} from "../../ViewModel";
import {CallToastCollectionViewModel} from "./calls/CallsToastCollectionViewModel";
import {VerificationToastCollectionViewModel} from "./verification/VerificationToastCollectionViewModel";
import type {Session} from "../../../matrix/Session.js";
import type {SegmentType} from "../../navigation";
import type {BaseToastNotificationViewModel} from "./BaseToastNotificationViewModel";
import type {IToastCollection} from "./IToastCollection";

type Options = {
    session: Session;
} & BaseOptions;

export class ToastCollectionViewModel extends ViewModel<SegmentType, Options> {
    public readonly toastViewModels: ConcatList<BaseToastNotificationViewModel>;

    constructor(options: Options) {
        super(options);
        const session = this.getOption("session");
        const collectionVms: IToastCollection[] = [];
        if (this.features.calls) {
            collectionVms.push(this.track(new CallToastCollectionViewModel(this.childOptions({ session }))));
        }
        if (this.features.crossSigning) {
            collectionVms.push(this.track(new VerificationToastCollectionViewModel(this.childOptions({ session }))));
        }
        const vms: IToastCollection["toastViewModels"][] = collectionVms.map(vm => vm.toastViewModels);
        if (vms.length !== 0) {
            this.toastViewModels = new ConcatList(...vms);
        }
    }
}
