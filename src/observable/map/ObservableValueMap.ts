/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseObservableMap} from "./BaseObservableMap";
import {BaseObservableValue} from "../value/BaseObservableValue";
import {SubscriptionHandle} from "../BaseObservable";

export class ObservableValueMap<K, V> extends BaseObservableMap<K, V> {
    private subscription?: SubscriptionHandle;

    constructor(private readonly key: K, private readonly observableValue: BaseObservableValue<V>) {
        super();
    }

    onSubscribeFirst() {
        this.subscription = this.observableValue.subscribe(value => {
            this.emitUpdate(this.key, value, undefined);
        });
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        this.subscription!();
        super.onUnsubscribeLast();
    }

    *[Symbol.iterator](): Iterator<[K, V]> {
        yield [this.key, this.observableValue.get()];
    }
    
    get size(): number {
        return 1;
    }

    get(key: K): V | undefined {
        if (key == this.key) {
            return this.observableValue.get();
        }
    }
}
