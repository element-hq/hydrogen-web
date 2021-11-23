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

export class ObservableArray extends BaseObservableList {
    constructor(initialValues = []) {
        super();
        this._items = initialValues;
    }

    append(item) {
        this._items.push(item);
        this.emitAdd(this._items.length - 1, item);
    }

    remove(idx) {
        const [item] = this._items.splice(idx, 1);
        this.emitRemove(idx, item);
    }

    insertMany(idx, items) {
        for(let item of items) {
            this.insert(idx, item);
            idx += 1;
        }
    }

    insert(idx, item) {
        this._items.splice(idx, 0, item);
        this.emitAdd(idx, item);
    }

    move(fromIdx, toIdx) {
        if (fromIdx < this._items.length && toIdx < this._items.length) {
            const [item] = this._items.splice(fromIdx, 1);
            this._items.splice(toIdx, 0, item);
            this.emitMove(fromIdx, toIdx, item);
        }
    }

    update(idx, item, params = null) {
        if (idx < this._items.length) {
            this._items[idx] = item;
            this.emitUpdate(idx, item, params);
        }
    }

    get array() {
        return this._items;
    }

    at(idx) {
        if (this._items && idx >= 0 && idx < this._items.length) {
            return this._items[idx];
        }
    }

    get length() {
        return this._items.length;
    }

    [Symbol.iterator]() {
        return this._items.values();
    }
}
