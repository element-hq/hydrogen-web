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

import {BaseObservableMap, BaseObservableMapConfig} from "./BaseObservableMap";
import {SubscriptionHandle} from "../BaseObservable";
import {config, Mapper, Updater, Comparator, Filter} from "./config";
import {JoinedMap} from "./JoinedMap.js";
import {MappedMap} from "./MappedMap.js";
import {FilteredMap} from "./FilteredMap.js";
import {SortedMapList} from "../list/SortedMapList.js";


export class ApplyMap<K, V> extends BaseObservableMap<K, V> {
    private _source: BaseObservableMap<K, V>;
    private _subscription?: SubscriptionHandle;
    private _apply?: Apply<K, V>;
    private _config: BaseObservableMapConfig<K, V>;

    constructor(source: BaseObservableMap<K, V>, apply?: Apply<K, V>) {
        super();
        this._source = source;
        this._apply = apply;
        this._config = config<K, V>();
    }

    join(...otherMaps: Array<typeof this>): JoinedMap<K, V> {
        return this._config.join(this, ...otherMaps);
    }

    mapValues(mapper: Mapper<V>, updater?: Updater<V>): MappedMap<K, V> {
        return this._config.mapValues(this, mapper, updater);
    }

    sortValues(comparator: Comparator<V>): SortedMapList {
        return this._config.sortValues(this, comparator);
    }

    filterValues(filter: Filter<K, V>): FilteredMap<K, V> {
        return this._config.filterValues(this, filter);
    }

    hasApply() {
        return !!this._apply;
    }

    setApply(apply?: Apply<K, V>) {
        this._apply = apply;
        if (this._apply) {
            this.applyOnce(this._apply);
        }
    }

    applyOnce(apply: Apply<K, V>) {
        for (const [key, value] of this._source) {
            apply(key, value);
        }
    }

    onAdd(key: K, value: V) {
        if (this._apply) {
            this._apply(key, value);
        }
        this.emitAdd(key, value);
    }

    onRemove(key: K, value: V) {
        this.emitRemove(key, value);
    }

    onUpdate(key: K, value: V, params: any) {
        if (this._apply) {
            this._apply(key, value, params);
        }
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst() {
        this._subscription = this._source.subscribe(this);
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        if (this._subscription) this._subscription = this._subscription();
    }

    onReset() {
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        this.emitReset();
    }

    [Symbol.iterator]() {
        return this._source[Symbol.iterator]();
    }

    get size() {
        return this._source.size;
    }

    get(key: K) {
        return this._source.get(key);
    }
}

type Apply<K, V> = (key: K, value: V, params?: any) => void;