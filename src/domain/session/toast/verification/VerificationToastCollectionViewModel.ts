/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
        if (request.sender !== this.getOption("session").userId) {
            // Don't show toast for cross-signing other users
            return;
        }
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
