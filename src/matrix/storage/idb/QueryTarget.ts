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
import {StorageError} from "../common";
import {ILogItem} from "../../../logging/types";
import {IDBKey} from "./Transaction";

// this is the part of the Transaction class API that is used here and in the Store subclass,
// to make it easier to replace it with alternative implementations in schema.ts and unit tests
export interface ITransaction {
    idbFactory: IDBFactory;
    IDBKeyRange: typeof IDBKeyRange;
    databaseName: string;
    addWriteError(error: StorageError, refItem: ILogItem | undefined, operationName: string, keys: IDBKey[] | undefined);
}

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
    protected _transaction: ITransaction;

    constructor(target: QueryTargetInterface<T>, transaction: ITransaction) {
        this._target = target;
        this._transaction = transaction;
    }

    get idbFactory(): IDBFactory {
        return this._transaction.idbFactory;
    }

    get IDBKeyRange(): typeof IDBKeyRange {
        return this._transaction.IDBKeyRange;
    }

    get databaseName(): string {
        return this._transaction.databaseName;
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
     * If the callback returns true, the search is halted and callback won't be called again.
     */
    async findExistingKeys(keys: IDBValidKey[], backwards: boolean, callback: (key: IDBValidKey, pk: IDBValidKey) => boolean): Promise<void> {
        const compareKeys = (a, b) => backwards ? -this.idbFactory.cmp(a, b) : this.idbFactory.cmp(a, b);
        const sortedKeys = keys.slice().sort(compareKeys);
        const firstKey = sortedKeys[0];
        const lastKey = sortedKeys[sortedKeys.length - 1];
        const direction = backwards ? "prev" : "next";
        const cursor = this._target.openKeyCursor(this.IDBKeyRange.bound(firstKey, lastKey), direction);
        let index = 0;
        await iterateCursor(cursor, (value, key, cursor) => {
            while (index < sortedKeys.length && compareKeys(sortedKeys[index], key) < 0) {
                index += 1;
            }
            let done = false;
            if (sortedKeys[index] === key) {
                const pk = cursor.primaryKey;
                done = callback(key, pk);
                index += 1;
            }
            if (done || index >= sortedKeys.length) {
                return DONE;
            } else {
                return {
                    done: false,
                    jumpTo: sortedKeys[index],
                }
            }
        });
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

import {createMockDatabase, MockIDBImpl} from "../../../mocks/Storage";
import {txnAsPromise} from "./utils";
import {QueryTargetWrapper, Store} from "./Store";

export function tests() {

    class MockTransaction extends MockIDBImpl {
        get databaseName(): string { return "mockdb"; }
        addWriteError(error: StorageError, refItem: ILogItem | undefined, operationName: string, keys: IDBKey[] | undefined) {}
    }

    interface TestEntry {
        key: string
    }

    async function createTestStore(): Promise<Store<TestEntry>> {
        const mockImpl = new MockTransaction();
        const db = await createMockDatabase("findExistingKeys", (db: IDBDatabase) => {
            db.createObjectStore("test", {keyPath: "key"});
        }, mockImpl);
        const txn = db.transaction(["test"], "readwrite");
        return new Store<TestEntry>(txn.objectStore("test"), mockImpl);
    }

    return {
        "findExistingKeys should not match on empty store": async assert => {
            const store = await createTestStore();
            await store.findExistingKeys(["2db1a709-d8f1-4c40-a835-f312badd277a", "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"], false, () => {
                assert.fail("no key should match");
                return false;
            });
        },
        "findExistingKeys should not match any existing keys (in between sorting order)": async assert => {
            const store = await createTestStore();
            store.add({key: "43cd16eb-a6b4-4b9d-ab36-ab87d1b038c3"});
            store.add({key: "b655e7c5-e02d-4823-a7af-4202b12de659"});
            await store.findExistingKeys(["2db1a709-d8f1-4c40-a835-f312badd277a", "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"], false, () => {
                assert.fail("no key should match");
                return false;
            });
        },
        "findExistingKeys should match only existing keys": async assert => {
            const store = await createTestStore();
            store.add({key: "2db1a709-d8f1-4c40-a835-f312badd277a"});
            store.add({key: "43cd16eb-a6b4-4b9d-ab36-ab87d1b038c3"});
            store.add({key: "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"});
            const found: string[] = [];
            await store.findExistingKeys([
                "2db1a709-d8f1-4c40-a835-f312badd277a",
                "eac3ef5c-a48f-4e19-b41d-ebd1d84c53f2",
                "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"
            ], false, (key: IDBValidKey) => {
                found.push(key as string);
                return false;
            });
            assert.equal(found.length, 2);
            assert.equal(found[0], "2db1a709-d8f1-4c40-a835-f312badd277a");
            assert.equal(found[1], "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2");
        },
        "findExistingKeys should match all if all exist": async assert => {
            const store = await createTestStore();
            store.add({key: "2db1a709-d8f1-4c40-a835-f312badd277a"});
            store.add({key: "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"});
            store.add({key: "b655e7c5-e02d-4823-a7af-4202b12de659"});
            const found: string[] = [];
            await store.findExistingKeys([
                "2db1a709-d8f1-4c40-a835-f312badd277a",
                "b655e7c5-e02d-4823-a7af-4202b12de659",
                "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"
            ], false, (key: IDBValidKey) => {
                found.push(key as string);
                return false;
            });
            assert.equal(found.length, 3);
            assert.equal(found[0], "2db1a709-d8f1-4c40-a835-f312badd277a");
            assert.equal(found[1], "b655e7c5-e02d-4823-a7af-4202b12de659");
            assert.equal(found[2], "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2");
        },
        "findExistingKeys should stop matching when callback returns true": async assert => {
            const store = await createTestStore();
            store.add({key: "2db1a709-d8f1-4c40-a835-f312badd277a"});
            store.add({key: "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"});
            store.add({key: "b655e7c5-e02d-4823-a7af-4202b12de659"});
            const found: string[] = [];
            await store.findExistingKeys([
                "2db1a709-d8f1-4c40-a835-f312badd277a",
                "b655e7c5-e02d-4823-a7af-4202b12de659",
                "fe7aa5c2-d4ed-4278-b3b0-f49d48d11df2"
            ], false, (key: IDBValidKey) => {
                found.push(key as string);
                return true;
            });
            assert.equal(found.length, 1);
            assert.equal(found[0], "2db1a709-d8f1-4c40-a835-f312badd277a");
        },
        
    }
}
