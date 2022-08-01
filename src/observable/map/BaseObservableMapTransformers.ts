/*
Copyright 2022 Isaiah Becker-Mayer <ibeckermayer@gmail.com>

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
import type {BaseObservableMap} from "./BaseObservableMap";
import {FilteredMap} from "./FilteredMap";
import {MappedMap} from "./MappedMap";
import {JoinedMap} from "./JoinedMap";
import {SortedMapList} from "../list/SortedMapList.js";


// This class provides implementations of functions that transform one BaseObservableMap
// to another type of Map. It's methods are effectively default implementations of the
// methods by the same name on BaseObservableMap.
//
// It is kept as its own class in its own file in order to avoid circular dependencies
// which would occur if these method implementations were defined on BaseObservableMap
// itself. For example, if we attmpted to do the following on BaseObservableMap:
//
// class BaseObservableMap<K, V> extends BaseObservable<IMapObserver<K, V>> {
//   join(...otherMaps: Array<BaseObservableMap<K, V>>): JoinedMap<K, V> {
//      return new JoinedMap(this.concat(otherMaps));
//   }
// }
//
// we would end up with a circular dependency between BaseObservableMap and JoinedMap,
// since BaseObservableMap would need to import JoinedMap for the
// `return new JoinedMap(this.concat(otherMaps))`, and
// JoinedMap would need to import BaseObservableMap to do
// `JoinedMap<K, V> extends BaseObservableMap<K, V>`.
export class BaseObservableMapTransformers<K, V> {
    join(_this: BaseObservableMap<K, V>, ...otherMaps: Array<BaseObservableMap<K, V>>): JoinedMap<K, V> {
       return new JoinedMap([_this].concat(otherMaps));
    }

    mapValues(_this: BaseObservableMap<K, V>, mapper: Mapper<V>, updater?: Updater<V>): MappedMap<K, V> {
        return new MappedMap(_this, mapper, updater);
    }

    sortValues(_this: BaseObservableMap<K, V>, comparator: Comparator<V>): SortedMapList {
        return new SortedMapList(_this, comparator);
    }

    filterValues(_this: BaseObservableMap<K, V>, filter: Filter<K, V>): FilteredMap<K, V> {
        return new FilteredMap(_this, filter);
    }
}

export type Mapper<V> = (
    value: V,
    emitSpontaneousUpdate: any,
) => V;

export type Updater<V> = (params: any, mappedValue?: V, value?: V) => void;

export type Comparator<V> = (a: V, b: V) => number;

export type Filter<K, V> = (v: V, k: K) => boolean;