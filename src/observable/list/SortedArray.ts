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

import {BaseObservableList} from "./BaseObservableList";
import {sortedIndex} from "../../utils/sortedIndex.js";
import {findAndUpdateInArray} from "./common";

export class SortedArray extends BaseObservableList {
    constructor(comparator) {
        super();
        this._comparator = comparator;
        this._items = [];
    }

    setManyUnsorted(items) {
        this.setManySorted(items);
    }

    setManySorted(items) {
        // TODO: we can make this way faster by only looking up the first and last key,
        // and merging whatever is inbetween with items
        // if items is not sorted, 💩🌀 will follow!
        // should we check?
        // Also, once bulk events are supported in collections,
        // we can do a bulk add event here probably if there are no updates
        // BAD CODE!
        for(let item of items) {
            this.set(item);
        }
    }

    findAndUpdate(predicate, updater) {
        return findAndUpdateInArray(predicate, this._items, this, updater);
    }

    getAndUpdate(item, updater, updateParams = null) {
        const idx = this.indexOf(item);
        if (idx !== -1) {
            const existingItem = this._items[idx];
            const newItem = updater(existingItem, item);
            this._items[idx] = newItem;
            this.emitUpdate(idx, newItem, updateParams);
        }
    }

    update(item, updateParams = null) {
        const idx = this.indexOf(item);
        if (idx !== -1) {
            this._items[idx] = item;
            this.emitUpdate(idx, item, updateParams);
        }
    }

    indexOf(item) {
        const idx = sortedIndex(this._items, item, this._comparator);
        if (idx < this._items.length && this._comparator(this._items[idx], item) === 0) {
            return idx;
        } else {
            return -1;
        }
    }

    _getNext(item) {
        let idx = sortedIndex(this._items, item, this._comparator);
        while(idx < this._items.length && this._comparator(this._items[idx], item) <= 0) {
            idx += 1;
        }
        return this.get(idx);
    }

    set(item, updateParams = null) {
        const idx = sortedIndex(this._items, item, this._comparator);
        if (idx >= this._items.length || this._comparator(this._items[idx], item) !== 0) {
            this._items.splice(idx, 0, item);
            this.emitAdd(idx, item)
        } else {
            this._items[idx] = item;
            this.emitUpdate(idx, item, updateParams);
        }
    }

    get(idx) {
        return this._items[idx];
    }

    remove(idx) {
        const item = this._items[idx];
        this._items.splice(idx, 1);
        this.emitRemove(idx, item);
    }

    get array() {
        return this._items;
    }

    get length() {
        return this._items.length;
    }

    [Symbol.iterator]() {
        return new Iterator(this);
    }
}

// iterator that works even if the current value is removed while iterating
class Iterator {
    constructor(sortedArray) {
        this._sortedArray = sortedArray;
        this._current = null;
    }

    next() {
        if (this._sortedArray) {
            if (this._current) {
                this._current = this._sortedArray._getNext(this._current);
            } else {
                this._current = this._sortedArray.get(0);
            }
            if (this._current) {
                return {value: this._current};
            } else {
                // cause done below
                this._sortedArray = null;
            }
        }
        if (!this._sortedArray) {
            return {done: true};
        }
    }
}

export function tests() {
    return {
        "setManyUnsorted": assert => {
            const sa = new SortedArray((a, b) => a.localeCompare(b));
            sa.setManyUnsorted(["b", "a", "c"]);
            assert.equal(sa.length, 3);
            assert.equal(sa.get(0), "a");
            assert.equal(sa.get(1), "b");
            assert.equal(sa.get(2), "c");
        }, 
        "_getNext": assert => {
            const sa = new SortedArray((a, b) => a.localeCompare(b));
            sa.setManyUnsorted(["b", "a", "f"]);
            assert.equal(sa._getNext("a"), "b");
            assert.equal(sa._getNext("b"), "f");
            // also finds the next if the value is not in the collection
            assert.equal(sa._getNext("c"), "f");
            assert.equal(sa._getNext("f"), undefined);
        },
        "iterator with removals": assert => {
            const queue = new SortedArray((a, b) => a.idx - b.idx);
            queue.setManyUnsorted([{idx: 5}, {idx: 3}, {idx: 1}, {idx: 4}, {idx: 2}]);
            const it = queue[Symbol.iterator]();
            assert.equal(it.next().value.idx, 1);
            assert.equal(it.next().value.idx, 2);
            queue.remove(1);
            assert.equal(it.next().value.idx, 3);
            queue.remove(1);
            assert.equal(it.next().value.idx, 4);
            queue.remove(1);
            assert.equal(it.next().value.idx, 5);
            queue.remove(1);
            assert.equal(it.next().done, true);
            // check done persists
            assert.equal(it.next().done, true);
        }
    }
}
