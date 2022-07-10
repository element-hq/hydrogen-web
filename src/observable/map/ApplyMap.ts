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

import {BaseObservableMap} from "./BaseObservableMap";
import {SubscriptionHandle} from "../BaseObservable";
import {BaseObservableMapDefaults, Mapper, Updater, Comparator, Filter} from "./BaseObservableMapDefaults";
import {JoinedMap} from "./JoinedMap";
import {MappedMap} from "./MappedMap";
import {FilteredMap} from "./FilteredMap";
import {SortedMapList} from "../list/SortedMapList.js";


export class ApplyMap<K, V> extends BaseObservableMap<K, V> {
    private _defaults = new BaseObservableMapDefaults<K, V>();
    private _source: BaseObservableMap<K, V>;
    private _subscription?: SubscriptionHandle;
    private _apply?: Apply<K, V>;


    constructor(source: BaseObservableMap<K, V>, apply?: Apply<K, V>) {
        super();
        this._source = source;
        this._apply = apply;
    }

    hasApply(): boolean {
        return !!this._apply;
    }

    setApply(apply?: Apply<K, V>): void {
        this._apply = apply;
        if (this._apply) {
            this.applyOnce(this._apply);
        }
    }

    applyOnce(apply: Apply<K, V>): void {
        for (const [key, value] of this._source) {
            apply(key, value);
        }
    }

    onAdd(key: K, value: V): void {
        if (this._apply) {
            this._apply(key, value);
        }
        this.emitAdd(key, value);
    }

    onRemove(key: K, value: V): void {
        this.emitRemove(key, value);
    }

    onUpdate(key: K, value: V, params: any): void {
        if (this._apply) {
            this._apply(key, value, params);
        }
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst(): void {
        this._subscription = this._source.subscribe(this);
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        if (this._subscription) this._subscription = this._subscription();
    }

    onReset(): void {
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        this.emitReset();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    [Symbol.iterator]() {
        return this._source[Symbol.iterator]();
    }

    get size(): number {
        return this._source.size;
    }

    get(key: K): V | undefined {
        return this._source.get(key);
    }

    join(...otherMaps: Array<typeof this>): JoinedMap<K, V> {
        return this._defaults.join(this, ...otherMaps);
    }

    mapValues(mapper: Mapper<V>, updater?: Updater<V>): MappedMap<K, V> {
        return this._defaults.mapValues(this, mapper, updater);
    }

    sortValues(comparator: Comparator<V>): SortedMapList {
        return this._defaults.sortValues(this, comparator);
    }

    filterValues(filter: Filter<K, V>): FilteredMap<K, V> {
        return this._defaults.filterValues(this, filter);
    }

}

type Apply<K, V> = (key: K, value: V, params?: any) => void;