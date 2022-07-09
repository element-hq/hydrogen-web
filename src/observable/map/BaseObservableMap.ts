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
import {Mapper, Updater, Comparator, Filter} from "./config";

export interface IMapObserver<K, V> {
    onReset(): void;
    onAdd(key: K, value:V): void;
    onUpdate(key: K, value: V, params: any): void;
    onRemove(key: K, value: V): void
}

export type BaseObservableMapConfig<K, V> = {
    join(_this: BaseObservableMap<K, V>, ...otherMaps: Array<BaseObservableMap<K, V>>): JoinedMap<K, V>;
    mapValues(_this: BaseObservableMap<K, V>, mapper: any, updater?: Updater<V>): MappedMap<K, V>;
    sortValues(_this: BaseObservableMap<K, V>, comparator: Comparator<V>): SortedMapList;
    filterValues(_this: BaseObservableMap<K, V>, filter: Filter<K, V>): FilteredMap<K, V>;
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

    emitUpdate(key: K, value: V, params: any) {
        for(let h of this._handlers) {
            h.onUpdate(key, value, params);
        }
    }

    emitRemove(key: K, value: V) {
        for(let h of this._handlers) {
            h.onRemove(key, value);
        }
    }

    // The following group of functions have a default implementation
    // in the neighboring `config.ts`. See the comment in that file for
    // the explanation for why the default implementation isn't defined
    // here. See the neighboring `ObservableMap.ts` for an example of how
    // to easily use the default implementation in a class that extends
    // this one (which is most likely what you want to do).
    abstract join(...otherMaps: Array<typeof this>): JoinedMap<K, V>;
    abstract mapValues(mapper: Mapper<V>, updater?: Updater<V>): MappedMap<K, V>;
    abstract sortValues(comparator: Comparator<V>): SortedMapList;
    abstract filterValues(filter: Filter<K, V>): FilteredMap<K, V>;

    abstract [Symbol.iterator](): Iterator<[K, V]>;
    abstract get size(): number;
    abstract get(key: K): V | undefined;
}
