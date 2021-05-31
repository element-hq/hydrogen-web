/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {BaseObservableList} from "./BaseObservableList.js";
import {findAndUpdateInArray} from "./common.js";

export class MappedList extends BaseObservableList {
    constructor(sourceList, mapper, updater, removeCallback) {
        super();
        this._sourceList = sourceList;
        this._mapper = mapper;
        this._updater = updater;
        this._removeCallback = removeCallback;
        this._sourceUnsubscribe = null;
        this._mappedValues = null;
    }

    onSubscribeFirst() {
        this._sourceUnsubscribe = this._sourceList.subscribe(this);
        this._mappedValues = [];
        for (const item of this._sourceList) {
            this._mappedValues.push(this._mapper(item));
        }
    }

    onReset() {
        this._mappedValues = [];
        this.emitReset();
    }

    onAdd(index, value) {
        const mappedValue = this._mapper(value);
        this._mappedValues.splice(index, 0, mappedValue);
        this.emitAdd(index, mappedValue);
    }

    onUpdate(index, value, params) {
        // if an update is emitted while calling source.subscribe() from onSubscribeFirst, ignore it
        if (!this._mappedValues) {
            return;
        }
        const mappedValue = this._mappedValues[index];
        if (this._updater) {
            this._updater(mappedValue, params, value);
        }
        this.emitUpdate(index, mappedValue, params);
    }

    onRemove(index) {
        const mappedValue = this._mappedValues[index];
        this._mappedValues.splice(index, 1);
        if (this._removeCallback) {
            this._removeCallback(mappedValue);
        }
        this.emitRemove(index, mappedValue);
    }

    onMove(fromIdx, toIdx) {
        const mappedValue = this._mappedValues[fromIdx];
        this._mappedValues.splice(fromIdx, 1);
        this._mappedValues.splice(toIdx, 0, mappedValue);
        this.emitMove(fromIdx, toIdx, mappedValue);
    }

    onUnsubscribeLast() {
        this._sourceUnsubscribe();
    }

    findAndUpdate(predicate, updater) {
        return findAndUpdateInArray(predicate, this._mappedValues, this, updater);
    }

    get length() {
        return this._mappedValues.length;
    }

    [Symbol.iterator]() {
        return this._mappedValues.values();
    }
}

import {ObservableArray} from "./ObservableArray.js";

export async function tests() {
    class MockList extends BaseObservableList {
        get length() {
            return 0;
        }
        [Symbol.iterator]() {
            return [].values();
        }
    }

    return {
        test_add(assert) {
            const source = new MockList();
            const mapped = new MappedList(source, n => {return {n: n*n};});
            let fired = false;
            const unsubscribe = mapped.subscribe({
                onAdd(idx, value) {
                    fired = true;
                    assert.equal(idx, 0);
                    assert.equal(value.n, 36);
                }
            });
            source.emitAdd(0, 6);
            assert(fired);
            unsubscribe();
        },
        test_update(assert) {
            const source = new MockList();
            const mapped = new MappedList(
                source,
                n => {return {n: n*n};},
                (o, p, n) => o.m = n*n
            );
            let fired = false;
            const unsubscribe = mapped.subscribe({
                onAdd() {},
                onUpdate(idx, value) {
                    fired = true;
                    assert.equal(idx, 0);
                    assert.equal(value.n, 36);
                    assert.equal(value.m, 49);
                }
            });
            source.emitAdd(0, 6);
            source.emitUpdate(0, 7);
            assert(fired);
            unsubscribe();
        },
        "test findAndUpdate not found": assert => {
            const source = new ObservableArray([1, 3, 4]);
            const mapped = new MappedList(
                source,
                n => {return n*n;}
            );
            mapped.subscribe({
                onUpdate() { assert.fail(); }
            });
            assert.equal(mapped.findAndUpdate(
                n => n === 100,
                () => assert.fail()
            ), false);
        },
        "test findAndUpdate found but updater bails out of update": assert => {
            const source = new ObservableArray([1, 3, 4]);
            const mapped = new MappedList(
                source,
                n => {return n*n;}
            );
            mapped.subscribe({
                onUpdate() { assert.fail(); }
            });
            let fired = false;
            assert.equal(mapped.findAndUpdate(
                n => n === 9,
                n => {
                    assert.equal(n, 9);
                    fired = true;
                    return false;
                }
            ), true);
            assert.equal(fired, true);
        },
        "test findAndUpdate emits update": assert => {
            const source = new ObservableArray([1, 3, 4]);
            const mapped = new MappedList(
                source,
                n => {return n*n;}
            );
            let fired = false;
            mapped.subscribe({
                onUpdate(idx, n, params) {
                    assert.equal(idx, 1);
                    assert.equal(n, 9);
                    assert.equal(params, "param");
                    fired = true;
                }
            });
            assert.equal(mapped.findAndUpdate(n => n === 9, () => "param"), true);
            assert.equal(fired, true);
        },
        
    };
}
