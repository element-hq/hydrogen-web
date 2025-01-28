/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
