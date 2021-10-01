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

/**
 * Very simple least-recently-used cache implementation
 * that should be fast enough for very small cache sizes
 */
export class BaseLRUCache {
    constructor(limit) {
        this._limit = limit;
        this._entries = [];
    }

    _get(findEntryFn) {
        const idx = this._entries.findIndex(findEntryFn);
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

    _set(value, findEntryFn) {
        let indexToRemove = this._entries.findIndex(findEntryFn);
        this._entries.unshift(value);
        if (indexToRemove === -1) {
            if (this._entries.length > this._limit) {
                indexToRemove = this._entries.length - 1;
            }
        } else {
            // we added the entry at the start since we looked for the index
            indexToRemove += 1;
        }
        if (indexToRemove !== -1) {
            this._onEvictEntry(this._entries[indexToRemove]);
            this._entries.splice(indexToRemove, 1);
        }
    }

    _onEvictEntry() {}
}

export class LRUCache extends BaseLRUCache {
    constructor(limit, keyFn) {
        super(limit);
        this._keyFn = keyFn;
    }

    get(key) {
        return this._get(e => this._keyFn(e) === key);
    }

    set(value) {
        const key = this._keyFn(value);
        this._set(value, e => this._keyFn(e) === key);
    }
}

export function tests() {
    return {
        "can retrieve added entries": assert => {
            const cache = new LRUCache(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            assert.equal(cache.get(1).name, "Alice");
            assert.equal(cache.get(2).name, "Bob");
        },
        "first entry is evicted first": assert => {
            const cache = new LRUCache(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.set({id: 3, name: "Charly"});
            assert.equal(cache.get(1), undefined);
            assert.equal(cache.get(2).name, "Bob");
            assert.equal(cache.get(3).name, "Charly");
            assert.equal(cache._entries.length, 2);
        },
        "second entry is evicted if first is requested": assert => {
            const cache = new LRUCache(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.get(1);
            cache.set({id: 3, name: "Charly"});
            assert.equal(cache.get(1).name, "Alice");
            assert.equal(cache.get(2), undefined);
            assert.equal(cache.get(3).name, "Charly");
            assert.equal(cache._entries.length, 2);
        },
        "setting an entry twice removes the first": assert => {
            const cache = new LRUCache(2, e => e.id);
            cache.set({id: 1, name: "Alice"});
            cache.set({id: 2, name: "Bob"});
            cache.set({id: 1, name: "Al Ice"});
            cache.set({id: 3, name: "Charly"});
            assert.equal(cache.get(1).name, "Al Ice");
            assert.equal(cache.get(2), undefined);
            assert.equal(cache.get(3).name, "Charly");
            assert.equal(cache._entries.length, 2);
        },
        "evict callback is called": assert => {
            let evictions = 0;
            class CustomCache extends LRUCache {
                _onEvictEntry(entry) {
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
            class CustomCache extends LRUCache {
                _onEvictEntry(entry) {
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
