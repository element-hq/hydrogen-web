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
import {Mapper, Updater, Comparator, Filter} from "./BaseObservableMapDefaults";

export interface IMapObserver<K, V> {
    onReset(): void;
    onAdd(key: K, value:V): void;
    onUpdate(key: K, value: V, params: any): void;
    onRemove(key: K, value: V): void
}

export abstract class BaseObservableMap<K, V> extends BaseObservable<IMapObserver<K, V>> {
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

    // The following group of functions have a default implementation
    // in the neighboring `BaseObservableMapDefaults.ts`. See the comment
    // in that file for the explanation for why the default implementation
    // isn't defined here. See the neighboring `ObservableMap.ts` for an
    // example of how to easily add the boilerplate for using the default
    // implementations of these functions in a class that extends
    // this one (which is most likely what you want to do).
    abstract join(...otherMaps: Array<typeof this>): JoinedMap<K, V>;
    abstract mapValues(mapper: Mapper<V>, updater?: Updater<V>): MappedMap<K, V>;
    abstract sortValues(comparator: Comparator<V>): SortedMapList;
    abstract filterValues(filter: Filter<K, V>): FilteredMap<K, V>;

    abstract [Symbol.iterator](): Iterator<[K, V]>;
    abstract get size(): number;
    abstract get(key: K): V | undefined;
}
