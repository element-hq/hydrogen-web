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

import {iterateCursor, DONE, NOT_DONE, reqAsPromise} from "./utils";

type Reducer<A,B> = (acc: B, val: A) => B

export type IDBQuery = IDBValidKey | IDBKeyRange | undefined | null

interface QueryTargetInterface<T> {
    openCursor(range?: IDBQuery, direction?: IDBCursorDirection | undefined): IDBRequest<IDBCursorWithValue | null>;
    openKeyCursor(range?: IDBQuery, direction?: IDBCursorDirection | undefined): IDBRequest<IDBCursor | null>;
    supports(method: string): boolean;
    keyPath: string | string[];
    get(key: IDBValidKey | IDBKeyRange): IDBRequest<T | null>;
    getKey(key: IDBValidKey | IDBKeyRange): IDBRequest<IDBValidKey | undefined>;
}

export class QueryTarget<T> {
    protected _target: QueryTargetInterface<T>;

    constructor(target: QueryTargetInterface<T>) {
        this._target = target;
    }

    _openCursor(range?: IDBQuery, direction?: IDBCursorDirection): IDBRequest<IDBCursorWithValue | null> {
        if (range && direction) {
            return this._target.openCursor(range, direction);
        } else if (range) {
            return this._target.openCursor(range);
        } else if (direction) {
            return this._target.openCursor(null, direction);
        } else {
            return this._target.openCursor();
        }
    }

    supports(methodName: string): boolean {
        return this._target.supports(methodName);
    }

    get(key: IDBValidKey | IDBKeyRange): Promise<T | null> {
        return reqAsPromise(this._target.get(key));
    }

    getKey(key: IDBValidKey | IDBKeyRange): Promise<IDBValidKey | undefined> {
        if (this._target.supports("getKey")) {
            return reqAsPromise(this._target.getKey(key));
        } else {
            return reqAsPromise(this._target.get(key)).then(value => {
                if (value) {
                    let keyPath = this._target.keyPath;
                    if (typeof keyPath === "string") {
                        keyPath = [keyPath];
                    }
                    return keyPath.reduce((obj, key) => obj[key], value);
                }
            });
        }
    }

    reduce<B>(range: IDBQuery, reducer: Reducer<T,B>, initialValue: B): Promise<boolean> {
        return this._reduce(range, reducer, initialValue, "next");
    }

    reduceReverse<B>(range: IDBQuery, reducer: Reducer<T,B>, initialValue: B): Promise<boolean> {
        return this._reduce(range, reducer, initialValue, "prev");
    }
    
    selectLimit(range: IDBQuery, amount: number): Promise<T[]> {
        return this._selectLimit(range, amount, "next");
    }

    selectLimitReverse(range: IDBQuery, amount: number): Promise<T[]> {
        return this._selectLimit(range, amount, "prev");
    }

    selectWhile(range: IDBQuery, predicate: (v: T) => boolean): Promise<T[]> {
        return this._selectWhile(range, predicate, "next");
    }

    selectWhileReverse(range: IDBQuery, predicate: (v: T) => boolean): Promise<T[]> {
        return this._selectWhile(range, predicate, "prev");
    }

    async selectAll(range?: IDBQuery, direction?: IDBCursorDirection): Promise<T[]> {
        const cursor = this._openCursor(range, direction);
        const results: T[] = [];
        await iterateCursor<T>(cursor, (value) => {
            results.push(value);
            return NOT_DONE;
        });
        return results;
    }

    selectFirst(range: IDBQuery): Promise<T | undefined> {
        return this._find(range, () => true, "next");
    }

    selectLast(range: IDBQuery): Promise<T | undefined> {
        return this._find(range, () => true, "prev");
    }

    find(range: IDBQuery, predicate: (v: T) => boolean): Promise<T | undefined> {
        return this._find(range, predicate, "next");
    }

    findReverse(range: IDBQuery, predicate: (v : T) => boolean): Promise<T | undefined> {
        return this._find(range, predicate, "prev");
    }

    async findMaxKey(range: IDBQuery): Promise<IDBValidKey | undefined> {
        const cursor = this._target.openKeyCursor(range, "prev");
        let maxKey;
        await iterateCursor(cursor, (_, key) => {
            maxKey = key;
            return DONE;
        });
        return maxKey;
    }


    async iterateValues(range: IDBQuery, callback: (val: T, key: IDBValidKey, cur: IDBCursorWithValue) => boolean): Promise<void>  {
        const cursor = this._target.openCursor(range, "next");
        await iterateCursor<T>(cursor, (value, key, cur) => {
            return {done: callback(value, key, cur)};
        });
    }

    async iterateKeys(range: IDBQuery, callback: (key: IDBValidKey, cur: IDBCursor) => boolean): Promise<void> {
        const cursor = this._target.openKeyCursor(range, "next");
        await iterateCursor(cursor, (_, key, cur) => {
            return {done: callback(key, cur)};
        });
    }

    /**
     * Checks if a given set of keys exist.
     * Calls `callback(key, found)` for each key in `keys`, in key sorting order (or reversed if backwards=true).
     * If the callback returns true, the search is halted and callback won't be called again.
     * `callback` is called with the same instances of the key as given in `keys`, so direct comparison can be used.
     */
    async findExistingKeys(keys: IDBValidKey[], backwards: boolean, callback: (key: IDBValidKey, found: boolean) => boolean): Promise<void> {
        const direction = backwards ? "prev" : "next";
        const compareKeys = (a, b) => backwards ? -indexedDB.cmp(a, b) : indexedDB.cmp(a, b);
        const sortedKeys = keys.slice().sort(compareKeys);
        const firstKey = backwards ? sortedKeys[sortedKeys.length - 1] : sortedKeys[0];
        const lastKey = backwards ? sortedKeys[0] : sortedKeys[sortedKeys.length - 1];
        const cursor = this._target.openKeyCursor(IDBKeyRange.bound(firstKey, lastKey), direction);
        let i = 0;
        let consumerDone = false;
        await iterateCursor(cursor, (value, key) => {
            // while key is larger than next key, advance and report false
            while(i < sortedKeys.length && compareKeys(sortedKeys[i], key) < 0 && !consumerDone) {
                consumerDone = callback(sortedKeys[i], false);
                ++i;
            }
            if (i < sortedKeys.length && compareKeys(sortedKeys[i], key) === 0 && !consumerDone) {
                consumerDone = callback(sortedKeys[i], true);
                ++i;
            }
            const done = consumerDone || i >= sortedKeys.length;
            let jumpTo;
            if (!done) {
                jumpTo = sortedKeys[i];
            }
            return {done, jumpTo};
        });
        // report null for keys we didn't to at the end
        while (!consumerDone && i < sortedKeys.length) {
            consumerDone = callback(sortedKeys[i], false);
            ++i;
        }
    }

    _reduce<B>(range: IDBQuery, reducer: (reduced: B, value: T) => B, initialValue: B, direction: IDBCursorDirection): Promise<boolean> {
        let reducedValue = initialValue;
        const cursor = this._openCursor(range, direction);
        return iterateCursor<T>(cursor, (value) => {
            reducedValue = reducer(reducedValue, value);
            return NOT_DONE;
        });
    }

    _selectLimit(range: IDBQuery, amount: number, direction: IDBCursorDirection): Promise<T[]> {
        return this._selectUntil(range, (results) => {
            return results.length === amount;
        }, direction);
    }

    async _selectUntil(range: IDBQuery, predicate: (vs: T[], v: T) => boolean, direction: IDBCursorDirection): Promise<T[]> {
        const cursor = this._openCursor(range, direction);
        const results: T[] = [];
        await iterateCursor<T>(cursor, (value) => {
            results.push(value);
            return {done: predicate(results, value)};
        });
        return results;
    }

    // allows you to fetch one too much that won't get added when the predicate fails
    async _selectWhile(range: IDBQuery, predicate: (v: T) => boolean, direction: IDBCursorDirection): Promise<T[]> {
        const cursor = this._openCursor(range, direction);
        const results: T[] = [];
        await iterateCursor<T>(cursor, (value) => {
            const passesPredicate = predicate(value);
            if (passesPredicate) {
                results.push(value);
            }
            return {done: !passesPredicate};
        });
        return results;
    }

    async iterateWhile(range: IDBQuery, predicate: (v: T) => boolean): Promise<void> {
        const cursor = this._openCursor(range, "next");
        await iterateCursor<T>(cursor, (value) => {
            const passesPredicate = predicate(value);
            return {done: !passesPredicate};
        });
    }

    async _find(range: IDBQuery, predicate: (v: T) => boolean, direction: IDBCursorDirection): Promise<T | undefined> {
        const cursor = this._openCursor(range, direction);
        let result;
        const found = await iterateCursor<T>(cursor, (value) => {
            const found = predicate(value);
            if (found) {
                result = value;
            }
            return {done: found};
        });
        if (found) {
            return result;
        }
    }
}
