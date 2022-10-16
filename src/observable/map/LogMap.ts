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

import {BaseObservableMap} from "./index";
import {SubscriptionHandle} from "../BaseObservable";
import {ILogItem, LabelOrValues} from "../../logging/types";
import {LogLevel} from "../../logging/LogFilter";


/*
This class MUST never be imported directly from here.
Instead, it MUST be imported from index.ts. See the
top level comment in index.ts for details.
*/
export class LogMap<K, V> extends BaseObservableMap<K, V> {
    private _source: BaseObservableMap<K, V>;
    private _subscription?: SubscriptionHandle;
    private _log: ILogItem;

    constructor(source: BaseObservableMap<K, V>, log: ILogItem) {
        super();
        this._source = source;
        this._log = log;
    }

    private log(labelOrValues: LabelOrValues, logLevel?: LogLevel): ILogItem {
        return this._log.log(labelOrValues, logLevel);
    }

    onAdd(key: K, value: V): void {
        this.log("add " + JSON.stringify({key, value}));
        this.emitAdd(key, value);
    }

    onRemove(key: K, value: V): void {
        this.log("remove " + JSON.stringify({key, value}));
        this.emitRemove(key, value);
    }

    onUpdate(key: K, value: V, params: any): void {
        this.log("update" + JSON.stringify({key, value, params}));
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst(): void {
        this.log("subscribeFirst");
        this._subscription = this._source.subscribe(this);
        super.onSubscribeFirst();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        if (this._subscription) this._subscription = this._subscription();
        this.log("unsubscribeLast");
    }

    onReset(): void {
        this.log("reset");
        this.emitReset();
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return this._source[Symbol.iterator]();
    }

    get size(): number {
        return this._source.size;
    }

    get(key: K): V | undefined{
        return this._source.get(key);
    }
}
