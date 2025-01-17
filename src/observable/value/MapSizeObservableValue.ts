/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseObservableValue} from "./index";
import {BaseObservableMap} from "../map/index";
import type {SubscriptionHandle} from "../BaseObservable";

export class MapSizeObservableValue<K, V> extends BaseObservableValue<number> {
    private subscription?: SubscriptionHandle;

    constructor(private readonly map: BaseObservableMap<K, V>)
    {
        super();
    }

    onSubscribeFirst(): void {
        this.subscription = this.map.subscribe({
            onAdd: (key: K, value: V) => {
                this.emit(this.get());
            },
            onRemove: (key: K, value: V) => {
                this.emit(this.get());
            },
            onUpdate: (key: K, value: V) => {},
            onReset: () => {
                this.emit(this.get());
            },
        });
    }

    onUnsubscribeLast(): void {
        this.subscription = this.subscription?.();
    }

    get(): number {
        return this.map.size;
    }
}

import {ObservableMap} from "../map/index";

export function tests() {
    return {
        "emits update on add and remove": assert => {
            const map = new ObservableMap<string, number>();
            const size = new MapSizeObservableValue(map);
            const updates: number[] = [];
            size.subscribe(size => {
                updates.push(size);
            });
            map.add("hello", 1);
            map.add("world", 2);
            map.remove("world");
            map.remove("hello");
            assert.deepEqual(updates, [1, 2, 1, 0]);
        }
    };
}
