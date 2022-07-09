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
import {BaseObservableMap, BaseObservableMapConfig} from "./BaseObservableMap";
import {FilteredMap} from "./FilteredMap";
import {MappedMap} from "./MappedMap";
import {JoinedMap} from "./JoinedMap";
import {SortedMapList} from "../list/SortedMapList.js";


// This function is used as a default implementation of
// the respective abstract functions in BaseObservableMap.
// We implement it this way in order to avoid a circular
// dependency between the classes that are instantiated here
// (i.e. `new JoinedMap()`) and BaseObservableMap (as they extend it).
export function config<K, V>(): BaseObservableMapConfig<K, V> {
    return {
        join: (_this: BaseObservableMap<K, V>, ...otherMaps: Array<BaseObservableMap<K, V>>): JoinedMap<K, V> => {
            return new JoinedMap([_this].concat(otherMaps));
        },
        mapValues: (_this: BaseObservableMap<K, V>, mapper: Mapper<V>, updater?: Updater<V>): MappedMap<K, V> => {
            return new MappedMap(_this, mapper, updater);
        },
        sortValues: (_this: BaseObservableMap<K, V>, comparator: Comparator<V>): SortedMapList => {
            return new SortedMapList(_this, comparator);
        },
        filterValues: (_this: BaseObservableMap<K, V>, filter: Filter<K, V>): FilteredMap<K, V> => {
            return new FilteredMap(_this, filter);
        }
    };
}

export type Mapper<V> = (
    value: V,
    emitSpontaneousUpdate: any,
) => V;

export type Updater<V> = (params: any, mappedValue?: V, value?: V) => void;

export type Comparator<V> = (a: V, b: V) => number;

export type Filter<K, V> = (v: V, k: K) => boolean;