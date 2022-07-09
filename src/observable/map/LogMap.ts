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
import {config, Mapper, Updater, Comparator, Filter} from "./config";
import {FilteredMap} from "./FilteredMap.js";
import {MappedMap} from "./MappedMap.js";
import {JoinedMap} from "./JoinedMap.js";
import {SortedMapList} from "../list/SortedMapList.js";
import {SubscriptionHandle} from "../BaseObservable";
import {ILogItem, LabelOrValues} from "../../logging/types";
import {LogLevel} from "../../logging/LogFilter";

export class LogMap<K, V> extends BaseObservableMap<K, V> {
    private _source: BaseObservableMap<K, V>;
    private _subscription?: SubscriptionHandle;
    private _log: ILogItem;
    private _config: BaseObservableMapConfig<K, V>


    constructor(source: BaseObservableMap<K, V>, log: ILogItem) {
        super();
        this._source = source;
        this._log = log;
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

    private log(labelOrValues: LabelOrValues, logLevel?: LogLevel): ILogItem {
        return this._log.log(labelOrValues, logLevel);
    }

    onAdd(key: K, value: V) {
        this.log("add " + JSON.stringify({key, value}));
        this.emitAdd(key, value);
    }

    onRemove(key: K, value: V) {
        this.log("remove " + JSON.stringify({key, value}));
        this.emitRemove(key, value);
    }

    onUpdate(key: K, value: V, params: any) {
        this.log("update" + JSON.stringify({key, value, params}));
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst() {
        this.log("subscribeFirst");
        this._subscription = this._source.subscribe(this);
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        if (this._subscription) this._subscription = this._subscription();
        this.log("unsubscribeLast");
    }

    onReset() {
        this.log("reset");
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
