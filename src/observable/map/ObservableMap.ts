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


/*
This class MUST never be imported directly from here.
Instead, it MUST be imported from index.ts. See the
top level comment in index.ts for details.
*/
export class ObservableMap<K, V> extends BaseObservableMap<K, V> {
    private readonly _values: Map<K, V>;

    constructor(initialValues?: (readonly [K, V])[]) {
        super();
        this._values = new Map(initialValues);
    }

    update(key: K, params?: any): boolean {
        const value = this._values.get(key);
        if (value !== undefined) {
            // could be the same value, so it's already updated
            // but we don't assume this here
            this._values.set(key, value);
            this.emitUpdate(key, value, params);
            return true;
        }
        return false;   // or return existing value?
    }

    add(key: K, value: V): boolean {
        if (!this._values.has(key)) {
            this._values.set(key, value);
            this.emitAdd(key, value);
            return true;
        }
        return false;   // or return existing value?
    }

    remove(key: K): boolean {
        const value = this._values.get(key);
        if (value !== undefined) {
            this._values.delete(key);
            this.emitRemove(key, value);
            return true;
        } else {
            return false;
        }
    }

    set(key: K, value: V): boolean {
        if (this._values.has(key)) {
            // We set the value here because update only supports inline updates
            this._values.set(key, value);
            return this.update(key, undefined);
        }
        else {
            return this.add(key, value);
        }
    }

    reset(): void {
        this._values.clear();
        this.emitReset();
    }

    get(key: K): V | undefined {
        return this._values.get(key);
    }

    get size(): number {
        return this._values.size;
    }

    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this._values.entries();
    }

    values(): IterableIterator<V> {
        return this._values.values();
    }

    keys(): IterableIterator<K> {
        return this._values.keys();
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    return {
        test_initial_values(assert): void {
            const map = new ObservableMap([
                ["a", 5],
                ["b", 10]
            ]);
            assert.equal(map.size, 2);
            assert.equal(map.get("a"), 5);
            assert.equal(map.get("b"), 10);
        },

        test_add(assert): void {
            let fired = 0;
            const map = new ObservableMap<number, {value: number}>();
            map.subscribe({
                onAdd(key, value) {
                    fired += 1;
                    assert.equal(key, 1);
                    assert.deepEqual(value, {value: 5});
                },
                onUpdate() {},
                onRemove() {},
                onReset() {}
            });
            map.add(1, {value: 5});
            assert.equal(map.size, 1);
            assert.equal(fired, 1);
        },

        test_update(assert): void {
            let fired = 0;
            const map = new ObservableMap<number, {number: number}>();
            const value = {number: 5};
            map.add(1, value);
            map.subscribe({
                onUpdate(key, value, params) {
                    fired += 1;
                    assert.equal(key, 1);
                    assert.deepEqual(value, {number: 6});
                    assert.equal(params, "test");
                },
                onAdd() {},
                onRemove() {},
                onReset() {}
            });
            value.number = 6;
            map.update(1, "test");
            assert.equal(fired, 1);
        },

        test_update_unknown(assert): void {
            let fired = 0;
            const map = new ObservableMap<number, {number: number}>();
            map.subscribe({
                onUpdate() { fired += 1; },
                onAdd() {},
                onRemove() {},
                onReset() {}
            });
            const result = map.update(1);
            assert.equal(fired, 0);
            assert.equal(result, false);
        },

        test_set(assert): void {
            let add_fired = 0, update_fired = 0;
            const map = new ObservableMap<number, {value: number}>();
            map.subscribe({
                onAdd(key, value) {
                    add_fired += 1;
                    assert.equal(key, 1);
                    assert.deepEqual(value, {value: 5});
                },
                onUpdate(key, value/*, params*/) {
                    update_fired += 1;
                    assert.equal(key, 1);
                    assert.deepEqual(value, {value: 7});
                },
                onRemove() {},
                onReset() {}
            });
            // Add
            map.set(1, {value: 5});
            assert.equal(map.size, 1);
            assert.equal(add_fired, 1);
            // Update
            map.set(1, {value: 7});
            assert.equal(map.size, 1);
            assert.equal(update_fired, 1);
        },

        test_remove(assert): void {
            let fired = 0;
            const map = new ObservableMap<number, {value: number}>();
            const value = {value: 5};
            map.add(1, value);
            map.subscribe({
                onRemove(key, value) {
                    fired += 1;
                    assert.equal(key, 1);
                    assert.deepEqual(value, {value: 5});
                },
                onAdd() {},
                onUpdate() {},
                onReset() {}
            });
            map.remove(1);
            assert.equal(map.size, 0);
            assert.equal(fired, 1);
        },

        test_iterate(assert): void {
            const results: any[] = [];
            const map = new ObservableMap<number, {number: number}>();
            map.add(1, {number: 5});
            map.add(2, {number: 6});
            map.add(3, {number: 7});
            for (let e of map) {
                results.push(e);
            }
            assert.equal(results.length, 3);
            assert.equal(results.find(([key]) => key === 1)[1].number, 5);
            assert.equal(results.find(([key]) => key === 2)[1].number, 6);
            assert.equal(results.find(([key]) => key === 3)[1].number, 7);
        },
        test_size(assert): void {
            const map = new ObservableMap<number, {number: number}>();
            map.add(1, {number: 5});
            map.add(2, {number: 6});
            assert.equal(map.size, 2);
        },
    };
}
