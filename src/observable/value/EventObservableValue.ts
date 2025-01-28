/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseObservableValue} from "./index";
import {EventEmitter} from "../../utils/EventEmitter";

export class EventObservableValue<T, V extends EventEmitter<T>> extends BaseObservableValue<V> {
    private eventSubscription: () => void;

    constructor(
        private readonly value: V,
        private readonly eventName: keyof T
    ) {
        super();
    }

    onSubscribeFirst(): void {
        this.eventSubscription = this.value.disposableOn(this.eventName, () => {
            this.emit(this.value);
        });
        super.onSubscribeFirst();
    }

    onUnsubscribeLast(): void {
        this.eventSubscription!();
        super.onUnsubscribeLast();
    }

    get(): V {
        return this.value;
    }
}
