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


type FindCallback<T> = (value: T) => boolean;
/**
 * Very simple least-recently-used cache implementation
 * that should be fast enough for very small cache sizes
 */
export class BaseLRUCache<T> {

    public readonly limit: number;
    protected _entries: T[];

    constructor(limit: number) {
        this.limit = limit;
        this._entries = [];
    }

    get size() { return this._entries.length; }

    protected _get(findEntryFn: FindCallback<T>) {
        return this._getByIndexAndMoveUp(this._entries.findIndex(findEntryFn));
    }

    protected _getByIndexAndMoveUp(idx: number) {
        if (idx !== -1) {
            const entry = this._entries[idx];
            // move to top
            if (idx > 0) {
                this._entries.splice(idx, 1);
                this._entries.unshift(entry);
            }
            return entry;
        }
    }

    protected _set(value: T, findEntryFn?: FindCallback<T>) {
        let indexToRemove = findEntryFn ? this._entries.findIndex(findEntryFn) : -1;
        this._entries.unshift(value);
        if (indexToRemove === -1) {
            if (this._entries.length > this.limit) {
                indexToRemove = this._entries.length - 1;
            }
        } else {
            // we added the entry at the start since we looked for the index
            indexToRemove += 1;
        }
        if (indexToRemove !== -1) {
            this.onEvictEntry(this._entries[indexToRemove]);
            this._entries.splice(indexToRemove, 1);
        }
    }

    protected onEvictEntry(entry: T) {}
}

export class LRUCache<T, K> extends BaseLRUCache<T> {
    private _keyFn: (T) => K;

    constructor(limit: number, keyFn: (T) => K) {
        super(limit);
        this._keyFn = keyFn;
    }

    get(key: K): T | undefined {
        return this._get(e => this._keyFn(e) === key);
    }

    set(value: T) {
        const key = this._keyFn(value);
        this._set(value, e => this._keyFn(e) === key);
    }
}

export function tests() {
    interface NameTuple {
        id: number;
        name: string;
    }

    return {
        "can retrieve added entries": assert => {
            const cache = new LRUCache<NameTuple, number>(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            assert.equal(cache.get(1)!.name, "Alice");
            assert.equal(cache.get(2)!.name, "Bob");
        },
        "first entry is evicted first": assert => {
            const cache = new LRUCache<NameTuple, number>(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.set({id: 3, name: "Charly"});
            assert.equal(cache.get(1), undefined);
            assert.equal(cache.get(2)!.name, "Bob");
            assert.equal(cache.get(3)!.name, "Charly");
            assert.equal(cache.size, 2);
        },
        "second entry is evicted if first is requested": assert => {
            const cache = new LRUCache<NameTuple, number>(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.get(1);
            cache.set({id: 3, name: "Charly"});
            assert.equal(cache.get(1)!.name, "Alice");
            assert.equal(cache.get(2), undefined);
            assert.equal(cache.get(3)!.name, "Charly");
            assert.equal(cache.size, 2);
        },
        "setting an entry twice removes the first": assert => {
            const cache = new LRUCache<NameTuple, number>(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.set({id: 1, name: "Al Ice"});
            cache.set({id: 3, name: "Charly"});
            assert.equal(cache.get(1)!.name, "Al Ice");
            assert.equal(cache.get(2), undefined);
            assert.equal(cache.get(3)!.name, "Charly");
            assert.equal(cache.size, 2);
        },
        "evict callback is called": assert => {
            let evictions = 0;
            class CustomCache extends LRUCache<NameTuple, number> {
                onEvictEntry(entry) {
                    assert.equal(entry.name, "Alice");
                    evictions += 1;
                }
            }
            const cache = new CustomCache(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.set({id: 3, name: "Charly"});
            assert.equal(evictions, 1);
        },
        "evict callback is called when replacing entry with same identity": assert => {
            let evictions = 0;
            class CustomCache extends LRUCache<NameTuple, number> {
                onEvictEntry(entry) {
                    assert.equal(entry.name, "Alice");
                    evictions += 1;
                }
            }
            const cache = new CustomCache(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 1, name: "Bob"});
            assert.equal(evictions, 1);
        },
        
    };
}
