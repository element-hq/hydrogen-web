/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
