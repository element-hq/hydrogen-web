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

export class ObservableArray<T> extends BaseObservableList<T> {
    private _items: T[];

    constructor(initialValues: T[] = []) {
        super();
        this._items = initialValues;
    }

    append(item: T): void {
        this._items.push(item);
        this.emitAdd(this._items.length - 1, item);
    }

    remove(idx: number): void {
        const [item] = this._items.splice(idx, 1);
        this.emitRemove(idx, item);
    }

    insertMany(idx: number, items: T[]): void {
        for(let item of items) {
            this.insert(idx, item);
            idx += 1;
        }
    }

    insert(idx: number, item: T): void {
        this._items.splice(idx, 0, item);
        this.emitAdd(idx, item);
    }

    move(fromIdx: number, toIdx: number): void {
        if (fromIdx < this._items.length && toIdx < this._items.length) {
            const [item] = this._items.splice(fromIdx, 1);
            this._items.splice(toIdx, 0, item);
            this.emitMove(fromIdx, toIdx, item);
        }
    }

    update(idx: number, item: T, params: any = null): void {
        if (idx < this._items.length) {
            this._items[idx] = item;
            this.emitUpdate(idx, item, params);
        }
    }

    get array(): Readonly<T[]> {
        return this._items;
    }

    at(idx: number): T | undefined {
        if (this._items && idx >= 0 && idx < this._items.length) {
            return this._items[idx];
        }
    }

    get length(): number {
        return this._items.length;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this._items.values();
    }
}
