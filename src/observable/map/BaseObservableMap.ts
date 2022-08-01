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

import {BaseObservable} from "../BaseObservable";
import {JoinedMap} from "../map/JoinedMap";
import {MappedMap} from "../map/MappedMap";
import {FilteredMap} from "../map/FilteredMap";
import {SortedMapList} from "../list/SortedMapList.js";
import type {BaseObservableMapTransformers, Mapper, Updater, Comparator, Filter} from "./BaseObservableMapTransformers";


export interface IMapObserver<K, V> {
    onReset(): void;
    onAdd(key: K, value:V): void;
    onUpdate(key: K, value: V, params: any): void;
    onRemove(key: K, value: V): void
}

export abstract class BaseObservableMap<K, V> extends BaseObservable<IMapObserver<K, V>> {
    private _defaults: BaseObservableMapTransformers<K, V>;

    constructor(defaults: BaseObservableMapTransformers<K, V>) {
        super();
        this._defaults = defaults;
    }

    emitReset(): void {
        for(let h of this._handlers) {
            h.onReset();
        }
    }
    // we need batch events, mostly on index based collection though?
    // maybe we should get started without?
    emitAdd(key: K, value: V): void {
        for(let h of this._handlers) {
            h.onAdd(key, value);
        }
    }

    emitUpdate(key: K, value: V, params: any): void {
        for(let h of this._handlers) {
            h.onUpdate(key, value, params);
        }
    }

    emitRemove(key: K, value: V): void {
        for(let h of this._handlers) {
            h.onRemove(key, value);
        }
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


    abstract [Symbol.iterator](): Iterator<[K, V]>;
    abstract get size(): number;
    abstract get(key: K): V | undefined;
}
