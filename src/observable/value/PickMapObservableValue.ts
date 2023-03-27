/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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
