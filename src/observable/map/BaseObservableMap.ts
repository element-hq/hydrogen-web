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
import {JoinedMap} from "./index";
import {MappedMap} from "./index";
import {FilteredMap} from "./index";
import {BaseObservableValue, MapSizeObservableValue} from "../value/index";
import {SortedMapList} from "../list/SortedMapList.js";


export interface IMapObserver<K, V> {
    onReset(): void;
    onAdd(key: K, value:V): void;
    onUpdate(key: K, value: V, params: any): void;
    onRemove(key: K, value: V): void
}

/*
This class MUST never be imported directly from here.
Instead, it MUST be imported from index.ts. See the
top level comment in index.ts for details.
*/
export abstract class BaseObservableMap<K, V> extends BaseObservable<IMapObserver<K, V>> {

    constructor() {
        super();
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

    join<E extends BaseObservableMap<K, V>>(...otherMaps: Array<E>): JoinedMap<K, V> {
        return new JoinedMap([this as BaseObservableMap<K, V>].concat(otherMaps));
    }

    mapValues<MappedV>(mapper: Mapper<V, MappedV>, updater?: Updater<V, MappedV>): MappedMap<K, V, MappedV> {
        return new MappedMap(this, mapper, updater);
    }

    sortValues(comparator: Comparator<V>): SortedMapList {
        return new SortedMapList(this, comparator);
    }

    filterValues(filter: Filter<K, V>): FilteredMap<K, V> {
        return new FilteredMap(this, filter);
    }

    observeSize(): BaseObservableValue<number> {
        return new MapSizeObservableValue(this);
    }

    abstract [Symbol.iterator](): Iterator<[K, V]>;
    abstract get size(): number;
    abstract get(key: K): V | undefined;
}

export type Mapper<V, MappedV> = (
    value: V,
    emitSpontaneousUpdate: any,
) => MappedV;

export type Updater<V, MappedV> = (params: any, mappedValue?: MappedV, value?: V) => void;

export type Comparator<V> = (a: V, b: V) => number;

export type Filter<K, V> = (v: V, k: K) => boolean;
