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
import {JoinedMap} from "../map/JoinedMap.js";
import {MappedMap} from "../map/MappedMap.js";
import {FilteredMap} from "../map/FilteredMap.js";
import {SortedMapList} from "../list/SortedMapList.js";

export interface IMapObserver<K, V> {
    onReset(): void;
    onAdd(key: K, value:V): void;
    onUpdate(key: K, value: V, params: any): void;
    onRemove(key: K, value: V): void
}

export type BaseObservableMapConfig<K, V> = {
    join(_this: BaseObservableMap<K, V>, ...otherMaps: Array<BaseObservableMap<K, V>>): JoinedMap;
    mapValues(_this: BaseObservableMap<K, V>, mapper: any, updater?: (params: any) => void): MappedMap;
    sortValues(_this: BaseObservableMap<K, V>, comparator?: (a: any, b: any) => number): SortedMapList;
    filterValues(_this: BaseObservableMap<K, V>, filter: (v: V, k: K) => boolean): FilteredMap;
}

export abstract class BaseObservableMap<K, V> extends BaseObservable<IMapObserver<K, V>> {
    emitReset() {
        for(let h of this._handlers) {
            h.onReset();
        }
    }
    // we need batch events, mostly on index based collection though?
    // maybe we should get started without?
    emitAdd(key: K, value: V) {
        for(let h of this._handlers) {
            h.onAdd(key, value);
        }
    }

    emitUpdate(key, value, params) {
        for(let h of this._handlers) {
            h.onUpdate(key, value, params);
        }
    }

    emitRemove(key, value) {
        for(let h of this._handlers) {
            h.onRemove(key, value);
        }
    }

    abstract join(...otherMaps: Array<typeof this>): JoinedMap;
    abstract mapValues(mapper: any, updater?: (params: any) => void): MappedMap;
    abstract sortValues(comparator?: (a: any, b: any) => number): SortedMapList;
    abstract filterValues(filter: (v: V, k: K) => boolean): FilteredMap;
    abstract [Symbol.iterator](): Iterator<[K, V]>;
    abstract get size(): number;
    abstract get(key: K): V | undefined;
}
