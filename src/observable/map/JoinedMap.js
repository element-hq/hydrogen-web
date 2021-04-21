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

import {BaseObservableMap} from "./BaseObservableMap.js";

export class JoinedMap extends BaseObservableMap {
    constructor(sources) {
        super();
        this._sources = sources;
    }

    onAdd(key, value) {
        this.emitAdd(key, value);
    }

    onRemove(key, value) {
        this.emitRemove(key, value);
    }

    onUpdate(key, value, params) {
        this.emitUpdate(key, value, params);
    }

    onSubscribeFirst() {
        this._subscriptions = this._sources.map(source => source.subscribe(this));
        super.onSubscribeFirst();
    }

    onUnsubscribeLast() {
        super.onUnsubscribeLast();
        for (const s of this._subscriptions) {
            s();
        }
    }

    onReset() {
        this.emitReset();
    }

    [Symbol.iterator]() {
        return new JoinedIterator(this._sources);
    }

    get size() {
        return this._sources.reduce((sum, s) => sum + s.size, 0);
    }

    get(key) {
        for (const s of this._sources) {
            const value = s.get(key);
            if (value) {
                return value;
            }
        }
        return null;
    }
}

class JoinedIterator {
    constructor(sources) {
        this._sources = sources;
        this._sourceIndex = -1;
        this._currentIterator = null;
    }

    next() {
        let result;
        while (!result) {
            if (!this._currentIterator) {
                this._sourceIndex += 1;
                if (this._sources.length <= this._sourceIndex) {
                    return {done: true};
                }
                this._currentIterator = this._sources[this._sourceIndex][Symbol.iterator]();
            }
            const sourceResult = this._currentIterator.next();
            if (sourceResult.done) {
                this._currentIterator = null;
                continue;
            } else {
                result = sourceResult;
            }
        }
        return result;
    }
}

export function tests() {
    return {
        "joined iterator": assert => {
            const it = new JoinedIterator([[1, 2], [3, 4]]);
            assert.equal(it.next().value, 1);
            assert.equal(it.next().value, 2);
            assert.equal(it.next().value, 3);
            assert.equal(it.next().value, 4);
            assert.equal(it.next().done, true);
        }
    };
}
