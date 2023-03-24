
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
import { SASVerification } from "../../../../matrix/verification/SAS/SASVerification";

type Options = {
    session: Session;
} & BaseOptions;



export class VerificationToastCollectionViewModel extends ViewModel<SegmentType, Options> implements IToastCollection {
    public readonly toastViewModels: ObservableArray<VerificationToastNotificationViewModel> = new ObservableArray();

    constructor(options: Options) {
        super(options);
        this.observeSASRequests();
    }

    async observeSASRequests() {
        const session = this.getOption("session");
        if (this.features.crossSigning) {
            // todo: hack; remove
            await new Promise(r => setTimeout(r, 3000));
            const sasObservable = session.crossSigning.receivedSASVerification;
            this.track(
                sasObservable.subscribe((sas) => {
                    if (sas) {
                        this.createToast(sas);
                    }
                    else {
                        this.toastViewModels.remove(0);
                    }
                })
            );
        }
    }

    private createToast(sas: SASVerification) {
        const dismiss = () => {
            const idx = this.toastViewModels.array.findIndex(vm => vm.sas === sas);
            if (idx !== -1) {
                this.toastViewModels.remove(idx);
            }
        };
        this.toastViewModels.append(new VerificationToastNotificationViewModel(this.childOptions({ sas, dismiss })));
    }
}
