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
import {sortedIndex} from "../../utils/sortedIndex";
import {findAndUpdateInArray} from "./common";

export class SortedArray<T> extends BaseObservableList<T> {
    private _comparator: (left: T, right: T) => number;
    private _items: T[] = [];

    constructor(comparator: (left: T, right: T) => number) {
        super();
        this._comparator = comparator;
    }

    setManyUnsorted(items: T[]): void {
        this.setManySorted(items);
    }

    setManySorted(items: T[]): void {
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

    findAndUpdate(predicate: (value: T) => boolean, updater: (value: T) => any | false): boolean {
        return findAndUpdateInArray(predicate, this._items, this, updater);
    }

    getAndUpdate(item: T, updater: (existing: T, item: T) => any, updateParams: any = null): void {
        const idx = this.indexOf(item);
        if (idx !== -1) {
            const existingItem = this._items[idx];
            const newItem = updater(existingItem, item);
            this._items[idx] = newItem;
            this.emitUpdate(idx, newItem, updateParams);
        }
    }

    update(item: T, updateParams: any = null): void {
        const idx = this.indexOf(item);
        if (idx !== -1) {
            this._items[idx] = item;
            this.emitUpdate(idx, item, updateParams);
        }
    }

    indexOf(item: T): number {
        const idx = sortedIndex(this._items, item, this._comparator);
        if (idx < this._items.length && this._comparator(this._items[idx], item) === 0) {
            return idx;
        } else {
            return -1;
        }
    }

    _getNext(item: T): T | undefined {
        let idx = sortedIndex(this._items, item, this._comparator);
        while(idx < this._items.length && this._comparator(this._items[idx], item) <= 0) {
            idx += 1;
        }
        return this.get(idx);
    }

    set(item: T, updateParams: any = null): void {
        const idx = sortedIndex(this._items, item, this._comparator);
        if (idx >= this._items.length || this._comparator(this._items[idx], item) !== 0) {
            this._items.splice(idx, 0, item);
            this.emitAdd(idx, item);
        } else {
            this._items[idx] = item;
            this.emitUpdate(idx, item, updateParams);
        }
    }

    get(idx: number): T | undefined {
        return this._items[idx];
    }

    remove(idx: number): void {
        const item = this._items[idx];
        this._items.splice(idx, 1);
        this.emitRemove(idx, item);
    }

    get array(): T[] {
        return this._items;
    }

    get length(): number {
        return this._items.length;
    }

    [Symbol.iterator](): Iterator<T> {
        return new Iterator(this);
    }
}

// iterator that works even if the current value is removed while iterating
class Iterator<T> {
    private _sortedArray: SortedArray<T>;
    private _current: T | null | undefined;
    private _consumed: boolean = false;

    constructor(sortedArray: SortedArray<T>) {
        this._sortedArray = sortedArray;
        this._current = null;
    }

    next(): IteratorResult<T> {
        if (this._consumed) {
            return {value: undefined, done: true};
        }
        this._current = this._current? this._sortedArray._getNext(this._current): this._sortedArray.get(0);
        if (!this._current) {
            this._consumed = true;
        }
        return { value: this._current, done: this._consumed } as IteratorResult<T>;
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    return {
        "setManyUnsorted": (assert): void => {
            const sa = new SortedArray<string>((a, b) => a.localeCompare(b));
            sa.setManyUnsorted(["b", "a", "c"]);
            assert.equal(sa.length, 3);
            assert.equal(sa.get(0), "a");
            assert.equal(sa.get(1), "b");
            assert.equal(sa.get(2), "c");
        },
        "_getNext": (assert): void => {
            const sa = new SortedArray<string>((a, b) => a.localeCompare(b));
            sa.setManyUnsorted(["b", "a", "f"]);
            assert.equal(sa._getNext("a"), "b");
            assert.equal(sa._getNext("b"), "f");
            // also finds the next if the value is not in the collection
            assert.equal(sa._getNext("c"), "f");
            assert.equal(sa._getNext("f"), undefined);
        },
        "iterator with removals": (assert): void => {
            const queue = new SortedArray<{idx: number}>((a, b) => a.idx - b.idx);
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
    };
}
