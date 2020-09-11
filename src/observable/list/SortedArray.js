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

import {BaseObservableList} from "./BaseObservableList.js";
import {sortedIndex} from "../../utils/sortedIndex.js";

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

    replace(item) {
        const idx = this.indexOf(item);
        if (idx !== -1) {
            this._items[idx] = item;
            this.emitUpdate(idx, item, null);
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
        return this._items.values();
    }
}
