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

// start is included in the range,
// end is excluded,
// so [2, 2[ means an empty range
class Range {
    constructor(
        public readonly start: number,
        public readonly end: number
    ) {}

    get length() {
        return this.end - this.start;
    }

    contains(range: Range): boolean {
        return range.start >= this.start && range.end <= this.end;
    }

    containsIndex(idx: number): boolean {
        return idx >= this.start && idx < this.end;
    }

    intersects(range: Range): boolean {
        return range.start < this.end && this.start < range.end;
    }

    forEach(callback: ((i: number) => void)) {
        for (let i = this.start; i < this.end; i += 1) {
            callback(i);
        }
    }

    forEachInIterator<T>(it: IterableIterator<T>, callback: ((T, i: number) => void)) {
        let i = 0;
        for (i = 0; i < this.start; i += 1) {
            it.next();
        }
        for (i = 0; i < this.length; i += 1) {
            const result = it.next();
            if (result.done) {
                break;
            } else {
                callback(result.value, this.start + i);
            }
        }
    }

    [Symbol.iterator](): Iterator<number> {
        return new RangeIterator(this);
    }
}

class RangeIterator implements Iterator<number> {
    private idx: number;
    constructor(private readonly range: Range) {
        this.idx = range.start - 1;
    }

    next(): IteratorResult<number> {
        if (this.idx < (this.range.end - 1)) {
            this.idx += 1;
            return {value: this.idx, done: false};
        } else {
            return {value: undefined, done: true};
        }
    }
}

export function tests() {
    return {
        "length": assert => {
            const a = new Range(2, 5);
            assert.equal(a.length, 3);
        },
        "iterator": assert => {
            assert.deepEqual(Array.from(new Range(2, 5)), [2, 3, 4]);
        },
        "containsIndex": assert => {
            const a = new Range(2, 5);
            assert.equal(a.containsIndex(0), false);
            assert.equal(a.containsIndex(1), false);
            assert.equal(a.containsIndex(2), true);
            assert.equal(a.containsIndex(3), true);
            assert.equal(a.containsIndex(4), true);
            assert.equal(a.containsIndex(5), false);
            assert.equal(a.containsIndex(6), false);
        },
        "intersects returns false for touching ranges": assert => {
            const a = new Range(2, 5);
            const b = new Range(5, 10);
            assert.equal(a.intersects(b), false);
            assert.equal(b.intersects(a), false);
        },
        "intersects returns false": assert => {
            const a = new Range(2, 5);
            const b = new Range(50, 100);
            assert.equal(a.intersects(b), false);
            assert.equal(b.intersects(a), false);
        },
        "intersects returns true for 1 overlapping item": assert => {
            const a = new Range(2, 5);
            const b = new Range(4, 10);
            assert.equal(a.intersects(b), true);
            assert.equal(b.intersects(a), true);
        },
        "contains beyond left edge": assert => {
            const a = new Range(2, 5);
            const b = new Range(1, 3);
            assert.equal(a.contains(b), false);
        },
        "contains at left edge": assert => {
            const a = new Range(2, 5);
            const b = new Range(2, 3);
            assert.equal(a.contains(b), true);
        },
        "contains between edges": assert => {
            const a = new Range(2, 5);
            const b = new Range(3, 4);
            assert.equal(a.contains(b), true);
        },
        "contains at right edge": assert => {
            const a = new Range(2, 5);
            const b = new Range(3, 5);
            assert.equal(a.contains(b), true);
        },
        "contains beyond right edge": assert => {
            const a = new Range(2, 5);
            const b = new Range(4, 6);
            assert.equal(a.contains(b), false);
        },
        "contains for non-intersecting ranges": assert => {
            const a = new Range(2, 5);
            const b = new Range(5, 6);
            assert.equal(a.contains(b), false);
        },
        "forEachInIterator with more values available": assert => {
            const callbackValues: {v: string, i: number}[] = [];
            const values = ["a", "b", "c", "d", "e", "f"];
            const it = values[Symbol.iterator]();
            new Range(2, 5).forEachInIterator(it, (v, i) => callbackValues.push({v, i}));
            assert.deepEqual(callbackValues, [
                {v: "c", i: 2},
                {v: "d", i: 3},
                {v: "e", i: 4},
            ]);
        },
        "forEachInIterator with fewer values available": assert => {
            const callbackValues: {v: string, i: number}[] = [];
            const values = ["a", "b", "c"];
            const it = values[Symbol.iterator]();
            new Range(2, 5).forEachInIterator(it, (v, i) => callbackValues.push({v, i}));
            assert.deepEqual(callbackValues, [
                {v: "c", i: 2},
            ]);
        },
    };
}

export class ItemRange extends Range {
    constructor(
        start: number,
        end: number,
        public readonly totalLength: number
    ) {
        super(start, end);
    }


    expand(amount: number): ItemRange {
        // don't expand ranges that won't render anything
        if (this.length === 0) {
            return this;
        }

        const topGrow = Math.min(amount, this.start);
        const bottomGrow = Math.min(amount, this.totalLength - this.end);
        return new ItemRange(
            this.start - topGrow,
            this.end + topGrow + bottomGrow,
            this.totalLength,
        );
    }

    static fromViewport(listLength: number, itemHeight: number, listHeight: number, scrollTop: number) {
        const topCount = Math.min(Math.max(0, Math.floor(scrollTop / itemHeight)), listLength);
        const itemsAfterTop = listLength - topCount;
        const visibleItems = listHeight !== 0 ? Math.ceil(listHeight / itemHeight) : 0;
        const renderCount = Math.min(visibleItems, itemsAfterTop);
        return new ItemRange(topCount, topCount + renderCount, listLength);
    }

    missingFrom() {

    }
}
