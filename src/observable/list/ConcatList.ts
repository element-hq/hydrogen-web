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

import {BaseObservableList, IListObserver} from "./BaseObservableList";

export class ConcatList<T> extends BaseObservableList<T> implements IListObserver<T> {
    protected _sourceLists: BaseObservableList<T>[];
    protected _sourceUnsubscribes: (() => void)[] | null = null;

    constructor(...sourceLists: BaseObservableList<T>[]) {
        super();
        this._sourceLists = sourceLists;
    }

    _offsetForSource(sourceList: BaseObservableList<T>): number {
        const listIdx = this._sourceLists.indexOf(sourceList);
        let offset = 0;
        for (let i = 0; i < listIdx; ++i) {
            offset += this._sourceLists[i].length;
        }
        return offset;
    }

    onSubscribeFirst(): void {
        this._sourceUnsubscribes = this._sourceLists.map(sourceList => sourceList.subscribe(this));
    }

    onUnsubscribeLast(): void {
        for (const sourceUnsubscribe of this._sourceUnsubscribes!) {
            sourceUnsubscribe();
        }
    }

    onReset(): void {
        // TODO: not ideal if other source lists are large
        // but working impl for now
        // reset, and
        this.emitReset();
        let idx = 0;
        for(const item of this) {
            this.emitAdd(idx, item);
            idx += 1;
        }
    }

    onAdd(index: number, value: T, sourceList: BaseObservableList<T>): void {
        this.emitAdd(this._offsetForSource(sourceList) + index, value);
    }

    onUpdate(index: number, value: T, params: any, sourceList: BaseObservableList<T>): void {
        // if an update is emitted while calling source.subscribe() from onSubscribeFirst, ignore it
        // as we are not supposed to call `length` on any uninitialized list
        if (!this._sourceUnsubscribes) {
            return;
        }
        this.emitUpdate(this._offsetForSource(sourceList) + index, value, params);
    }

    onRemove(index: number, value: T, sourceList: BaseObservableList<T>): void {
        this.emitRemove(this._offsetForSource(sourceList) + index, value);
    }

    onMove(fromIdx: number, toIdx: number, value: T, sourceList: BaseObservableList<T>): void {
        const offset = this._offsetForSource(sourceList);
        this.emitMove(offset + fromIdx, offset + toIdx, value);
    }

    get length(): number {
        let len = 0;
        for (let i = 0; i < this._sourceLists.length; ++i) {
            len += this._sourceLists[i].length;
        }
        return len;
    }

    [Symbol.iterator](): Iterator<T> {
        let sourceListIdx = 0;
        let it = this._sourceLists[0][Symbol.iterator]();
        return {
            next: (): IteratorResult<T> => {
                let result = it.next();
                while (result.done) {
                    sourceListIdx += 1;
                    if (sourceListIdx >= this._sourceLists.length) {
                        return result;  //done
                    }
                    it = this._sourceLists[sourceListIdx][Symbol.iterator]();
                    result = it.next();
                }
                return result;
            }
        };
    }
}

import {ObservableArray} from "./ObservableArray";
import {defaultObserverWith} from "./BaseObservableList";


// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function tests() {
    return {
        test_length(assert): void {
            const all = new ConcatList(
                new ObservableArray([1, 2, 3]),
                new ObservableArray([11, 12, 13])
            );
            assert.equal(all.length, 6);
        },
        test_iterator(assert): void {
            const all = new ConcatList(
                new ObservableArray([1, 2, 3]),
                new ObservableArray([11, 12, 13])
            );
            const it = all[Symbol.iterator]();
            assert.equal(it.next().value, 1);
            assert.equal(it.next().value, 2);
            assert.equal(it.next().value, 3);
            assert.equal(it.next().value, 11);
            assert.equal(it.next().value, 12);
            assert.equal(it.next().value, 13);
            assert(it.next().done);
        },
        test_add(assert): void {
            const list1 = new ObservableArray([1, 2, 3]);
            const list2 = new ObservableArray([11, 12, 13]);
            const all = new ConcatList(list1, list2);
            let fired = false;
            all.subscribe(defaultObserverWith({
                onAdd(index, value) {
                    fired = true;
                    assert.equal(index, 4);
                    assert.equal(value, 11.5);
                }
            }));
            list2.insert(1, 11.5);
            assert(fired);
        },
        test_update(assert): void {
            const list1 = new ObservableArray([1, 2, 3]);
            const list2 = new ObservableArray([11, 12, 13]);
            const all = new ConcatList(list1, list2);
            let fired = false;
            all.subscribe(defaultObserverWith({
                onUpdate(index, value) {
                    fired = true;
                    assert.equal(index, 4);
                    assert.equal(value, 10);
                }
            }));
            list2.emitUpdate(1, 10);
            assert(fired);
        },
    };
}
