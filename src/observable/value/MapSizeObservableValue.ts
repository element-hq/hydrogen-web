/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
