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

import {Range, RangeZone} from "./Range";
import {defaultObserverWith} from "../../../../observable/list/BaseObservableList";

function skipOnIterator<T>(it: Iterator<T>, pos: number): boolean {
    let i = 0;
    while (i < pos) {
        i += 1;
        if(it.next().done) {
            return false;
        }
    }
    return true;
}

function getIteratorValueAtIdx<T>(it: Iterator<T>, idx: number): undefined | T {
    if (skipOnIterator(it, idx)) {
        const result = it.next();
        if (!result.done) {
            return result.value;
        }
    }
    return undefined;
}

export enum ResultType {
    Move,
    Add,
    Remove,
    RemoveAndAdd,
    UpdateRange
}

export interface MoveResult {
    type: ResultType.Move;
    fromIdx: number;
    toIdx: number
}

interface AddResult<T> {
    type: ResultType.Add;
    newRange?: ListRange;
    /** the list index of an item to add */
    addIdx: number;
    /** the value to add at addIdx */
    value: T
}

interface RemoveResult {
    type: ResultType.Remove;
    newRange?: ListRange;
    /** the list index of an item to remove, before the add or remove event has been taken into account */
    removeIdx: number;
}

// need to repeat the fields from RemoveResult and AddResult here
// to make the discriminated union work
interface RemoveAndAddResult<T> {
    type: ResultType.RemoveAndAdd;
    newRange?: ListRange;
    /** the list index of an item to remove, before the add or remove event has been taken into account */
    removeIdx: number;
    /** the list index of an item to add */
    addIdx: number;
    /** the value to add at addIdx */
    value: T;
}

interface UpdateRangeResult {
    type: ResultType.UpdateRange;
    newRange?: ListRange;
}

export type AddRemoveResult<T> = AddResult<T> | RemoveResult | RemoveAndAddResult<T> | UpdateRangeResult;

export class ListRange extends Range {
    constructor(
        start: number,
        end: number,
        private _totalLength: number,
        private _viewportItemCount: number = end - start
    ) {
        super(start, end);
    }

    expand(amount: number): ListRange {
        // don't expand ranges that won't render anything
        if (this.length === 0) {
            return this;
        }
        const newStart = Math.max(0, this.start - amount);
        const newEnd = Math.min(this.totalLength, this.end + amount);
        return new ListRange(
            newStart,
            newEnd,
            this.totalLength,
            this._viewportItemCount
        );
    }

    get totalLength(): number {
        return this._totalLength;
    }

    get viewportItemCount(): number {
        return this._viewportItemCount;
    }

    static fromViewport(listLength: number, itemHeight: number, listHeight: number, scrollTop: number) {
        const topCount = Math.min(Math.max(0, Math.floor(scrollTop / itemHeight)), listLength);
        const itemsAfterTop = listLength - topCount;
        const viewportItemCount = listHeight !== 0 ? Math.ceil(listHeight / itemHeight) : 0;
        const renderCount = Math.min(viewportItemCount, itemsAfterTop);
        return new ListRange(topCount, topCount + renderCount, listLength, viewportItemCount);
    }

    queryAdd<T>(idx: number, value: T, list: Iterable<T>): AddRemoveResult<T> {
        const maxAddIdx = this.viewportItemCount > this.length ? this.end : this.end - 1;
        if (idx <= maxAddIdx) {
            // use maxAddIdx to allow to grow the range by one at a time
            // if the viewport isn't filled yet
            const addIdx = this.clampIndex(idx, maxAddIdx);
            const addValue = addIdx === idx ? value : getIteratorValueAtIdx(list[Symbol.iterator](), addIdx)!;
            return this.createAddResult<T>(addIdx, addValue);
        } else {
            // if the add happened after the range, we only update the range with the new length
            return {type: ResultType.UpdateRange, newRange: this.deriveRange(1, 0)};
        }
    }

    queryRemove<T>(idx: number, list: Iterable<T>): AddRemoveResult<T> {
        if (idx < this.end) {
            const removeIdx = this.clampIndex(idx);
            return this.createRemoveResult(removeIdx, list);
        } else {
            return {type: ResultType.UpdateRange, newRange: this.deriveRange(-1, 0)};
        }
    }

    queryMove<T>(fromIdx: number, toIdx: number, value: T, list: Iterable<T>): MoveResult | AddRemoveResult<T> | undefined {
        const fromZone = this.getIndexZone(fromIdx);
        const toZone = this.getIndexZone(toIdx);
        if (fromZone === toZone) {
            if (fromZone === RangeZone.Before || fromZone === RangeZone.After) {
                return;
            } else if (fromZone === RangeZone.Inside) {
                return {type: ResultType.Move, fromIdx, toIdx};
            }
        } else {
            const addIdx = this.clampIndex(toIdx);
            const removeIdx = this.clampIndex(fromIdx);
            const addValue = addIdx === toIdx ? value : getIteratorValueAtIdx(list[Symbol.iterator](), addIdx)!;
            return {type: ResultType.RemoveAndAdd, removeIdx, addIdx, value: addValue};
        }
    }

    private createAddResult<T>(addIdx: number, value: T): AddRemoveResult<T> {
        // if the view port isn't filled yet, we don't remove
        if (this.viewportItemCount > this.length) {
            return {type: ResultType.Add, addIdx, value, newRange: this.deriveRange(1, 1)};
        } else {
            const removeIdx = this.clampIndex(Number.MAX_SAFE_INTEGER);
            return {type: ResultType.RemoveAndAdd, removeIdx, addIdx, value, newRange: this.deriveRange(1, 0)};
        }
    }

    private createRemoveResult<T>(removeIdx: number, list: Iterable<T>): AddRemoveResult<T> {
        if (this.end < this.totalLength) {
            // we have items below the range, we can add one from there to fill the viewport
            const addIdx = this.clampIndex(Number.MAX_SAFE_INTEGER);
            // we assume the value has already been removed from the list,
            // so we can just look up the next value which is already at the same idx
            const value = getIteratorValueAtIdx(list[Symbol.iterator](), addIdx)!;
            return {type: ResultType.RemoveAndAdd, removeIdx, value, addIdx, newRange: this.deriveRange(-1, 0)};
        } else if (this.start !== 0) {
            // move the range 1 item up so we still display a viewport full of items
            const newRange = this.deriveRange(-1, 0, 1);
            const addIdx = newRange.start;
            // we assume the value has already been removed from the list,
            // so we can just look up the next value which is already at the same idx
            const value = getIteratorValueAtIdx(list[Symbol.iterator](), addIdx)!;
            return {type: ResultType.RemoveAndAdd, removeIdx, value, addIdx, newRange};
        } else {
            // we can't add at the bottom nor top, already constrained
            return {type: ResultType.Remove, removeIdx, newRange: this.deriveRange(-1, 0)};
        }
    }

    private deriveRange(totalLengthInc: number, viewportItemCountDecr: number, startDecr: number = 0): ListRange {
        const start = this.start - startDecr;
        const totalLength = this.totalLength + totalLengthInc;
        // prevent end being larger than totalLength
        const end = Math.min(Math.max(start, this.end - startDecr + viewportItemCountDecr), totalLength);
        return new ListRange(
            start,
            end,
            totalLength,
            this.viewportItemCount
        );
    }
}

import {ObservableArray} from "../../../../observable/list/ObservableArray";

export function tests() {
    return {
        "fromViewport": assert => {
            const range = ListRange.fromViewport(10, 20, 90, 30);
            assert.equal(range.start, 1);
            assert.equal(range.end, 6);
            assert.equal(range.totalLength, 10);
        },
        "fromViewport at end": assert => {
            const itemHeight = 20;
            const range = ListRange.fromViewport(10, itemHeight, 3 * itemHeight, 7 * itemHeight);
            assert.equal(range.start, 7);
            assert.equal(range.end, 10);
            assert.equal(range.totalLength, 10);
        },
        "fromViewport with not enough items to fill viewport": assert => {
            const itemHeight = 20;
            const range = ListRange.fromViewport(5, itemHeight, 8 * itemHeight, 0);
            assert.equal(range.start, 0);
            assert.equal(range.end, 5);
            assert.equal(range.totalLength, 5);
            assert.equal(range.length, 5);
            assert.equal(range.viewportItemCount, 8);
        },
        "expand at start of list": assert => {
            const range = new ListRange(1, 5, 10);
            const expanded = range.expand(2);
            assert.equal(expanded.start, 0);
            assert.equal(expanded.end, 7);
            assert.equal(expanded.totalLength, 10);
            assert.equal(expanded.length, 7);
        },
        "expand at end of list": assert => {
            const range = new ListRange(7, 9, 10);
            const expanded = range.expand(2);
            assert.equal(expanded.start, 5);
            assert.equal(expanded.end, 10);
            assert.equal(expanded.totalLength, 10);
            assert.equal(expanded.length, 5);
        },
        "expand in middle of list": assert => {
            const range = new ListRange(4, 6, 10);
            const expanded = range.expand(2);
            assert.equal(expanded.start, 2);
            assert.equal(expanded.end, 8);
            assert.equal(expanded.totalLength, 10);
            assert.equal(expanded.length, 6);
        },
        "queryAdd with addition before range": assert => {
            const list = new ObservableArray(["b", "c", "d", "e"]);
            const range = new ListRange(1, 3, list.length);
            let added = false;
            list.subscribe(defaultObserverWith({
                onAdd(idx, value) {
                    added = true;
                    const result = range.queryAdd(idx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 2,
                        addIdx: 1,
                        value: "b",
                        newRange: new ListRange(1, 3, 5)
                    });
                }
            }));
            list.insert(0, "a");
            assert(added);
        },
        "queryAdd with addition within range": assert => {
            const list = new ObservableArray(["a", "b", "d", "e"]);
            const range = new ListRange(1, 3, list.length);
            let added = false;
            list.subscribe(defaultObserverWith({
                onAdd(idx, value) {
                    added = true;
                    const result = range.queryAdd(idx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 2,
                        addIdx: 2,
                        value: "c",
                        newRange: new ListRange(1, 3, 5)
                    });
                }
            }));
            list.insert(2, "c");
            assert(added);
        },
        "queryAdd with addition after range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d"]);
            const range = new ListRange(1, 3, list.length);
            let added = false;
            list.subscribe(defaultObserverWith({
                onAdd(idx, value) {
                    added = true;
                    const result = range.queryAdd(idx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.UpdateRange,
                        newRange: new ListRange(1, 3, 5)
                    });
                }
            }));
            list.insert(4, "e");
            assert(added);
        },
        "queryAdd with too few items to fill viewport grows the range": assert => {
            const list = new ObservableArray(["a", "b", "d"]);
            const viewportItemCount = 4;
            const range = new ListRange(0, 3, list.length, viewportItemCount);
            let added = false;
            list.subscribe(defaultObserverWith({
                onAdd(idx, value) {
                    added = true;
                    const result = range.queryAdd(idx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.Add,
                        newRange: new ListRange(0, 4, 4),
                        addIdx: 2,
                        value: "c"
                    });
                }
            }));
            list.insert(2, "c");
            assert(added);
        },
        "queryRemove with removal before range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(1, 3, list.length);
            let removed = false;
            list.subscribe(defaultObserverWith({
                onRemove(idx) {
                    removed = true;
                    const result = range.queryRemove(idx, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 1,
                        addIdx: 2,
                        value: "d",
                        newRange: new ListRange(1, 3, 4)
                    });
                }
            }));
            list.remove(0);
            assert(removed);
        },
        "queryRemove with removal within range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(1, 3, list.length);
            let removed = false;
            list.subscribe(defaultObserverWith({
                onRemove(idx) {
                    removed = true;
                    const result = range.queryRemove(idx, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 2,
                        addIdx: 2,
                        value: "d",
                        newRange: new ListRange(1, 3, 4)
                    });
                    assert.equal(list.length, 4);
                }
            }));
            list.remove(2);
            assert(removed);
        },
        "queryRemove with removal after range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(1, 3, list.length);
            let removed = false;
            list.subscribe(defaultObserverWith({
                onRemove(idx) {
                    removed = true;
                    const result = range.queryRemove(idx, list);
                    assert.deepEqual(result, {
                        type: ResultType.UpdateRange,
                        newRange: new ListRange(1, 3, 4)
                    });
                }
            }));
            list.remove(3);
            assert(removed);
        },
        "queryRemove at bottom of range moves range one up": assert => {
            const list = new ObservableArray(["a", "b", "c"]);
            const range = new ListRange(1, 3, list.length);
            let removed = false;
            list.subscribe(defaultObserverWith({
                onRemove(idx) {
                    removed = true;
                    const result = range.queryRemove(idx, list);
                    assert.deepEqual(result, {
                        newRange: new ListRange(0, 2, 2),
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 2,
                        addIdx: 0,
                        value: "a"
                    });
                }
            }));
            list.remove(2);
            assert(removed);
        },
        "queryRemove with range on full length shrinks range": assert => {
            const list = new ObservableArray(["a", "b", "c"]);
            const range = new ListRange(0, 3, list.length);
            let removed = false;
            list.subscribe(defaultObserverWith({
                onRemove(idx) {
                    removed = true;
                    const result = range.queryRemove(idx, list);
                    assert.deepEqual(result, {
                        newRange: new ListRange(0, 2, 2, 3),
                        type: ResultType.Remove,
                        removeIdx: 2,
                    });
                }
            }));
            list.remove(2);
            assert(removed);
        },
        "queryMove with move inside range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(1, 4, list.length);
            let moved = false;
            list.subscribe(defaultObserverWith({
                onMove(fromIdx, toIdx, value) {
                    moved = true;
                    const result = range.queryMove(fromIdx, toIdx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.Move,
                        fromIdx: 2,
                        toIdx: 3
                    });
                }
            }));
            list.move(2, 3);
            assert(moved);
        },
        "queryMove with move from before to inside range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(2, 5, list.length);
            let moved = false;
            list.subscribe(defaultObserverWith({
                onMove(fromIdx, toIdx, value) {
                    moved = true;
                    const result = range.queryMove(fromIdx, toIdx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 2,
                        addIdx: 3,
                        value: "a"
                    });
                }
            }));
            list.move(0, 3); // move "a" to after "d"
            assert(moved);
        },
        "queryMove with move from after to inside range": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(0, 3, list.length);
            let moved = false;
            list.subscribe(defaultObserverWith({
                onMove(fromIdx, toIdx, value) {
                    moved = true;
                    const result = range.queryMove(fromIdx, toIdx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 2,
                        addIdx: 1,
                        value: "e"
                    });
                }
            }));
            list.move(4, 1); // move "e" to before "b"
            assert(moved);
        },
        "queryMove with move inside range to after": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(0, 3, list.length);
            let moved = false;
            list.subscribe(defaultObserverWith({
                onMove(fromIdx, toIdx, value) {
                    moved = true;
                    const result = range.queryMove(fromIdx, toIdx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 1,
                        addIdx: 2,
                        value: "d"
                    });
                }
            }));
            list.move(1, 3); // move "b" to after "d"
            assert(moved);
        },
        "queryMove with move inside range to before": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(2, 5, list.length);
            let moved = false;
            list.subscribe(defaultObserverWith({
                onMove(fromIdx, toIdx, value) {
                    moved = true;
                    const result = range.queryMove(fromIdx, toIdx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 3,
                        addIdx: 2,
                        value: "b"
                    });
                }
            }));
            list.move(3, 0); // move "d" to before "a"
            assert(moved);
        },
        "queryMove with move from before range to after": assert => {
            const list = new ObservableArray(["a", "b", "c", "d", "e"]);
            const range = new ListRange(1, 4, list.length);
            let moved = false;
            list.subscribe(defaultObserverWith({
                onMove(fromIdx, toIdx, value) {
                    moved = true;
                    const result = range.queryMove(fromIdx, toIdx, value, list);
                    assert.deepEqual(result, {
                        type: ResultType.RemoveAndAdd,
                        removeIdx: 1,
                        addIdx: 3,
                        value: "e"
                    });
                }
            }));
            list.move(0, 4); // move "a" to after "e"
            assert(moved);
        },
        // would be good to test here what multiple mutations look like with executing the result of queryXXX
        // on an array, much like we do in the view.
    };
}
