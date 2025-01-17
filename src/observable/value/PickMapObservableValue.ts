/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseObservableValue} from "./index";
import {BaseObservableMap, IMapObserver} from "../map/BaseObservableMap";
import {SubscriptionHandle} from "../BaseObservable";

function pickLowestKey<K>(currentKey: K, newKey: K): boolean {
    return newKey < currentKey;
}

export class PickMapObservableValue<K, V> extends BaseObservableValue<V | undefined>  implements IMapObserver<K, V>{

    private key?: K;
    private mapSubscription?: SubscriptionHandle;

    constructor(
        private readonly map: BaseObservableMap<K, V>,
        private readonly pickKey: (currentKey: K, newKey: K) => boolean = pickLowestKey
    ) {
        super();
    }

    private updateKey(newKey: K): boolean {
        if (this.key === undefined || this.pickKey(this.key, newKey)) {
            this.key = newKey;
            return true;
        }
        return false;
    }

    onReset(): void {
        this.key = undefined;
        this.emit(this.get());
    }

    onAdd(key: K, value:V): void {
        if (this.updateKey(key)) {
            this.emit(this.get());
        }
    }

    onUpdate(key: K, value: V, params: any): void {
        this.emit(this.get());
    }

    onRemove(key: K, value: V): void {
        if (key === this.key) {
            this.key = undefined;
            // try to see if there is another key that fullfills pickKey
            for (const [key] of this.map) {
                this.updateKey(key);
            }
            this.emit(this.get());
        }
    }

    onSubscribeFirst(): void {
        this.mapSubscription = this.map.subscribe(this);
        for (const [key] of this.map) {
            this.updateKey(key);
        }
    }

    onUnsubscribeLast(): void {
        this.mapSubscription!();
        this.key = undefined;
    }

    get(): V | undefined {
        if (this.key !== undefined) {
            return this.map.get(this.key);
        }
        return undefined;
    }
}
