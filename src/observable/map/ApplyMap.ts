/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseObservableMap} from "./index";
import {SubscriptionHandle} from "../BaseObservable";


/*
This class MUST never be imported directly from here.
Instead, it MUST be imported from index.ts. See the
top level comment in index.ts for details.
*/
export class ApplyMap<K, V> extends BaseObservableMap<K, V> {
    private _source: BaseObservableMap<K, V>;
    private _subscription?: SubscriptionHandle;
    private _apply?: Apply<K, V>;

    constructor(source: BaseObservableMap<K, V>, apply?: Apply<K, V>) {
        super();
        this._source = source;
        this._apply = apply;
    }

    hasApply(): boolean {
        return !!this._apply;
    }

    setApply(apply?: Apply<K, V>): void {
        this._apply = apply;
        if (this._apply) {
            this.applyOnce(this._apply);
        }
    }

    applyOnce(apply: Apply<K, V>): void {
        for (const [key, value] of this._source) {
            apply(key, value);
        }
    }

    onAdd(key: K, value: V): void {
        if (this._apply) {
            this._apply(key, value);
        }
        this.emitAdd(key, value);
    }

    onRemove(key: K, value: V): void {
        this.emitRemove(key, value);
    }

    onUpdate(key: K, value: V, params: any): void {
        if (this._apply) {
            this._apply(key, value, params);
        }
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst(): void {
        this._subscription = this._source.subscribe(this);
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        super.onSubscribeFirst();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        if (this._subscription) {
            this._subscription = this._subscription();
        }
    }

    onReset(): void {
        if (this._apply) {
            this.applyOnce(this._apply);
        }
        this.emitReset();
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return this._source[Symbol.iterator]();
    }

    get size(): number {
        return this._source.size;
    }

    get(key: K): V | undefined {
        return this._source.get(key);
    }
}

type Apply<K, V> = (key: K, value: V, params?: any) => void;