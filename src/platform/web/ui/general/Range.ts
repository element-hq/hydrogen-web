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
export class Range {
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

    toLocalIndex(idx: number) {
        return idx - this.start;
    }

    intersects(range: Range): boolean {
        return range.start < this.end && this.start < range.end;
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

    reverseIterable(): Iterable<number> {
        return new ReverseRangeIterator(this);
    }

    clampIndex(idx: number, end = this.end - 1) {
        return Math.min(Math.max(this.start, idx), end);
    }

    getIndexZone(idx): RangeZone {
        if (idx < this.start) {
            return RangeZone.Before;
        } else if (idx < this.end) {
            return RangeZone.Inside;
        } else {
            return RangeZone.After;
        }
    }
}

export enum RangeZone {
    Before = 1,
    Inside,
    After
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

class ReverseRangeIterator implements Iterable<number>, Iterator<number> {
    private idx: number;
    constructor(private readonly range: Range) {
        this.idx = range.end;
    }

    [Symbol.iterator]() {
        return this;
    }

    next(): IteratorResult<number> {
        if (this.idx > this.range.start) {
            this.idx -= 1;
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
        "reverseIterable": assert => {
            assert.deepEqual(Array.from(new Range(2, 5).reverseIterable()), [4, 3, 2]);
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
        "clampIndex": assert => {
            assert.equal(new Range(2, 5).clampIndex(0), 2);
            assert.equal(new Range(2, 5).clampIndex(2), 2);
            assert.equal(new Range(2, 5).clampIndex(3), 3);
            assert.equal(new Range(2, 5).clampIndex(4), 4);
            assert.equal(new Range(2, 5).clampIndex(5), 4);
            assert.equal(new Range(2, 5).clampIndex(10), 4);
        }
    };
}
