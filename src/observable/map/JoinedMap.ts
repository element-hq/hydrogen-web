/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {BaseObservableMap} from ".";
import {SubscriptionHandle} from "../BaseObservable";


/*
This class MUST never be imported directly from here.
Instead, it MUST be imported from index.ts. See the
top level comment in index.ts for details.
*/
export class JoinedMap<K, V> extends BaseObservableMap<K, V> {
    protected _sources: BaseObservableMap<K, V>[];
    private _subscriptions?: SourceSubscriptionHandler<K, V>[];

    constructor(sources: BaseObservableMap<K, V>[]) {
        super();
        this._sources = sources;
    }

    onAdd(source: BaseObservableMap<K, V>, key: K, value: V): void {
        if (!this._isKeyAtSourceOccluded(source, key)) {
            const occludingValue = this._getValueFromOccludedSources(source, key);
            if (occludingValue !== undefined) {
                // adding a value that will occlude another one should
                // first emit a remove
                this.emitRemove(key, occludingValue);
            }
            this.emitAdd(key, value);
        }
    }

    onRemove(source: BaseObservableMap<K, V>, key: K, value: V): void {
        if (!this._isKeyAtSourceOccluded(source, key)) {
            this.emitRemove(key, value);
            const occludedValue = this._getValueFromOccludedSources(source, key);
            if (occludedValue !== undefined) {
                // removing a value that so far occluded another one should
                // emit an add for the occluded value after the removal
                this.emitAdd(key, occludedValue);
            }
        }
    }

    onUpdate(source: BaseObservableMap<K, V>, key: K, value: V, params: any): void {
        // if an update is emitted while calling source.subscribe() from onSubscribeFirst, ignore it
        if (!this._subscriptions) {
            return;
        }
        if (!this._isKeyAtSourceOccluded(source, key)) {
            this.emitUpdate(key, value, params);
        }
    }

    onReset(): void {
        this.emitReset();
    }

    onSubscribeFirst(): void {
        this._subscriptions = this._sources.map(source => new SourceSubscriptionHandler(source, this).subscribe());
        super.onSubscribeFirst();
    }

    _isKeyAtSourceOccluded(source: BaseObservableMap<K, V>, key: K): boolean {
        // sources that come first in the sources array can
        // hide the keys in later sources, to prevent events
        // being emitted for the same key and different values,
        // so check the key is not present in earlier sources
        const index = this._sources.indexOf(source);
        for (let i = 0; i < index; i += 1) {
            if (this._sources[i].get(key) !== undefined) {
                return true;
            }
        }
        return false;
    }

    // get the value that the given source and key occlude, if any
    _getValueFromOccludedSources(source: BaseObservableMap<K, V>, key: K): V | undefined{
        // sources that come first in the sources array can
        // hide the keys in later sources, to prevent events
        // being emitted for the same key and different values,
        // so check the key is not present in earlier sources
        const index = this._sources.indexOf(source);
        for (let i = index + 1; i < this._sources.length; i += 1) {
            const source = this._sources[i];
            const occludedValue = source.get(key);
            if (occludedValue !== undefined) {
                return occludedValue;
            }
        }
        return undefined;
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        if (this._subscriptions) {
            for (const s of this._subscriptions) {
                s.dispose();
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    [Symbol.iterator]() {
        return new JoinedIterator<K, V>(this._sources);
    }

    get size(): number {
        return this._sources.reduce((sum, s) => sum + s.size, 0);
    }

    get(key: K): V | undefined {
        for (const s of this._sources) {
            const value = s.get(key);
            if (value) {
                return value;
            }
        }
        return undefined;
    }
}

class JoinedIterator<K, V> implements Iterator<[K, V]> {
    private _sources: {[Symbol.iterator](): Iterator<[K, V]>}[];
    private _sourceIndex = -1;
    private _encounteredKeys = new Set();
    private _currentIterator?: Iterator<[K, V]>

    constructor(sources: {[Symbol.iterator](): Iterator<[K, V]>}[]) {
        this._sources = sources;
    }

    next(): IteratorYieldResult<[K, V]> | IteratorReturnResult<null> {
        let result: IteratorYieldResult<[K, V]> | undefined = undefined;
        while (!result) {
            if (!this._currentIterator) {
                this._sourceIndex += 1;
                if (this._sources.length <= this._sourceIndex) {
                    return {done: true, value: null};
                }
                this._currentIterator = this._sources[this._sourceIndex][Symbol.iterator]();
            }
            const sourceResult = this._currentIterator?.next();
            if (!sourceResult || sourceResult.done) {
                this._currentIterator = undefined;
                continue;
            } else {
                const key = sourceResult.value[0];
                if (!this._encounteredKeys.has(key)) {
                    this._encounteredKeys.add(key);
                    result = sourceResult;
                }
            }
        }
        return result;
    }
}

class SourceSubscriptionHandler<K, V> {
    private _source: BaseObservableMap<K, V>;
    private _joinedMap: JoinedMap<K, V>;
    private _subscription?: SubscriptionHandle;

    constructor(source: BaseObservableMap<K, V>, joinedMap: JoinedMap<K, V>) {
        this._source = source;
        this._joinedMap = joinedMap;
        this._subscription = undefined;
    }

    subscribe(): this {
        this._subscription = this._source.subscribe(this);
        return this;
    }

    dispose(): void {
        if (this._subscription) this._subscription = this._subscription();
    }

    onAdd(key: K, value: V): void {
        this._joinedMap.onAdd(this._source, key, value);
    }

    onRemove(key: K, value: V): void {
        this._joinedMap.onRemove(this._source, key, value);
    }

    onUpdate(key: K, value: V, params: any): void {
        this._joinedMap.onUpdate(this._source, key, value, params);
    }

    onReset(): void {
        this._joinedMap.onReset();
    }
}


import {ObservableMap} from "..";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    function observeMap(map: JoinedMap<any, any>): { type: string; key: any; value: any; params?: any; }[] {
        const events: { type: string, key: any, value: any, params?: any }[] = [];
        map.subscribe({
            onAdd(key, value) { events.push({ type: "add", key, value }); },
            onRemove(key, value) { events.push({ type: "remove", key, value }); },
            onUpdate(key, value, params) { events.push({ type: "update", key, value, params }); },
            onReset: function (): void {
                return;
            }
        });
        return events;
    }

    return {
        "joined iterator": (assert): void => {
            const firstKV: [string, number] = ["a", 1];
            const secondKV: [string, number] = ["b", 2];
            const thirdKV: [string, number] = ["c", 3];
            const it = new JoinedIterator<string, number>([[firstKV, secondKV], [thirdKV]]);
            assert.equal(it.next().value, firstKV);
            assert.equal(it.next().value, secondKV);
            assert.equal(it.next().value, thirdKV);
            assert.equal(it.next().done, true);
        },
        "prevent key collision during iteration": (assert): void => {
            const first = new ObservableMap();
            const second = new ObservableMap();
            const join = new JoinedMap([first, second]);
            second.add("a", 2);
            second.add("b", 3);
            first.add("a", 1);
            const it = join[Symbol.iterator]();
            assert.deepEqual(it.next().value, ["a", 1]);
            assert.deepEqual(it.next().value, ["b", 3]);
            assert.equal(it.next().done, true);
        },
        "adding occluded key doesn't emit add": (assert): void => {
            const first = new ObservableMap();
            const second = new ObservableMap();
            const join = new JoinedMap([first, second]);
            const events = observeMap(join);
            first.add("a", 1);
            second.add("a", 2);
            assert.equal(events.length, 1);
            assert.equal(events[0].type, "add");
            assert.equal(events[0].key, "a");
            assert.equal(events[0].value, 1);
        },
        "updating occluded key doesn't emit update": (assert): void => {
            const first = new ObservableMap();
            const second = new ObservableMap();
            const join = new JoinedMap([first, second]);
            first.add("a", 1);
            second.add("a", 2);
            const events = observeMap(join);
            second.update("a", 3);
            assert.equal(events.length, 0);
        },
        "removal of occluding key emits add after remove": (assert): void => {
            const first = new ObservableMap();
            const second = new ObservableMap();
            const join = new JoinedMap([first, second]);
            first.add("a", 1);
            second.add("a", 2);
            const events = observeMap(join);
            first.remove("a");
            assert.equal(events.length, 2);
            assert.equal(events[0].type, "remove");
            assert.equal(events[0].key, "a");
            assert.equal(events[0].value, 1);
            assert.equal(events[1].type, "add");
            assert.equal(events[1].key, "a");
            assert.equal(events[1].value, 2);
        },
        "adding occluding key emits remove first": (assert): void => {
            const first = new ObservableMap();
            const second = new ObservableMap();
            const join = new JoinedMap([first, second]);
            second.add("a", 2);
            const events = observeMap(join);
            first.add("a", 1);
            assert.equal(events.length, 2);
            assert.equal(events[0].type, "remove");
            assert.equal(events[0].key, "a");
            assert.equal(events[0].value, 2);
            assert.equal(events[1].type, "add");
            assert.equal(events[1].key, "a");
            assert.equal(events[1].value, 1);
        }
    };
}
