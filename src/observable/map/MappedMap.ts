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

import {BaseObservableMap, Mapper, Updater} from "./index";
import {SubscriptionHandle} from "../BaseObservable";


/*
so a mapped value can emit updates on it's own with this._emitSpontaneousUpdate that is passed in the mapping function
how should the mapped value be notified of an update though? and can it then decide to not propagate the update?
*/
/*
This class MUST never be imported directly from here.
Instead, it MUST be imported from index.ts. See the
top level comment in index.ts for details.
*/
export class MappedMap<K, V, MappedV> extends BaseObservableMap<K, MappedV> {
    private _source: BaseObservableMap<K, V>;
    private _mapper: Mapper<V, MappedV>;
    private _updater?: Updater<V, MappedV>;
    private _mappedValues: Map<K, MappedV>;
    private _subscription?: SubscriptionHandle;


    constructor(
        source: BaseObservableMap<K, V>,
        mapper: Mapper<V, MappedV>,
        updater?: Updater<V, MappedV>
    ) {
        super();
        this._source = source;
        this._mapper = mapper;
        this._updater = updater;
        this._mappedValues = new Map<K, MappedV>();
    }

    _emitSpontaneousUpdate(key: K, params: any): void {
        const value = this._mappedValues.get(key);
        if (value) {
            this.emitUpdate(key, value, params);
        }
    }

    onAdd(key: K, value: V): void {
        const emitSpontaneousUpdate = this._emitSpontaneousUpdate.bind(this, key);
        const mappedValue = this._mapper(value, emitSpontaneousUpdate);
        this._mappedValues.set(key, mappedValue);
        this.emitAdd(key, mappedValue);
    }

    onRemove(key: K/*, _value*/): void {
        const mappedValue = this._mappedValues.get(key);
        if (this._mappedValues.delete(key)) {
            if (mappedValue) {
                this.emitRemove(key, mappedValue);
            }
        }
    }

    onUpdate(key: K, value: V, params: any): void {
        // if an update is emitted while calling source.subscribe() from onSubscribeFirst, ignore it
        if (!this._mappedValues) {
            return;
        }
        const mappedValue = this._mappedValues.get(key);
        if (mappedValue !== undefined) {
            this._updater?.(params, mappedValue, value);
            // TODO: map params somehow if needed?
            this.emitUpdate(key, mappedValue, params);
        }
    }

    onSubscribeFirst(): void {
        this._subscription = this._source.subscribe(this);
        for (let [key, value] of this._source) {
            const emitSpontaneousUpdate = this._emitSpontaneousUpdate.bind(this, key);
            const mappedValue = this._mapper(value, emitSpontaneousUpdate);
            this._mappedValues.set(key, mappedValue);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        if (this._subscription) {
            this._subscription = this._subscription();
        }
        this._mappedValues.clear();
    }

    onReset(): void {
        this._mappedValues.clear();
        this.emitReset();
    }

    [Symbol.iterator](): IterableIterator<[K, MappedV]> {
        return this._mappedValues.entries();
    }

    get size(): number {
        return this._mappedValues.size;
    }

    get(key: K): MappedV | undefined {
        return this._mappedValues.get(key);
    }
}