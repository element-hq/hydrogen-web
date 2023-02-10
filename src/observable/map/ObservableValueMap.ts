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
