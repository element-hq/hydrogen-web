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

import {QueryTarget, IDBQuery} from "./QueryTarget";
import {IDBRequestAttemptError} from "./error";
import {reqAsPromise} from "./utils";
import {Transaction} from "./Transaction";
import {LogItem} from "../../../logging/LogItem.js";

const LOG_REQUESTS = false;

function logRequest(method: string, params: any[], source: any): void {
    const storeName = source?.name;
    const databaseName = source?.transaction?.db?.name;
    console.info(`${databaseName}.${storeName}.${method}(${params.map(p => JSON.stringify(p)).join(", ")})`);
}

class QueryTargetWrapper<T> {
    private _qt: IDBIndex | IDBObjectStore;

    constructor(qt: IDBIndex | IDBObjectStore) {
        this._qt = qt;
    }

    get keyPath(): string | string[] {
        return this._qtStore.keyPath;
    }

    get _qtStore(): IDBObjectStore {
        if ("objectStore" in this._qt) {
            return this._qt.objectStore;
        }
        return this._qt;
    }

    supports(methodName: string): boolean {
        return !!this._qt[methodName];
    }
    
    openKeyCursor(range?: IDBQuery, direction?: IDBCursorDirection | undefined): IDBRequest<IDBCursor | null> {
        try {
            // not supported on Edge 15
            if (!this._qt.openKeyCursor) {
                LOG_REQUESTS && logRequest("openCursor", [range, direction], this._qt);
                return this.openCursor(range, direction);
            }
            LOG_REQUESTS && logRequest("openKeyCursor", [range, direction], this._qt);
            return this._qt.openKeyCursor(range, direction)
        } catch(err) {
            throw new IDBRequestAttemptError("openKeyCursor", this._qt, err, [range, direction]);
        }
    }
    
    openCursor(range?: IDBQuery, direction?: IDBCursorDirection | undefined): IDBRequest<IDBCursorWithValue | null> {
        try {
            LOG_REQUESTS && logRequest("openCursor", [], this._qt);
            return this._qt.openCursor(range, direction)
        } catch(err) {
            throw new IDBRequestAttemptError("openCursor", this._qt, err, [range, direction]);
        }
    }

    put(item: T, key?: IDBValidKey | undefined): IDBRequest<IDBValidKey> {
        try {
            LOG_REQUESTS && logRequest("put", [item, key], this._qt);
            return this._qtStore.put(item, key);
        } catch(err) {
            throw new IDBRequestAttemptError("put", this._qt, err, [item, key]);
        }
    }

    add(item: T, key?: IDBValidKey | undefined): IDBRequest<IDBValidKey> {
        try {
            LOG_REQUESTS && logRequest("add", [item, key], this._qt);
            return this._qtStore.add(item, key);
        } catch(err) {
            throw new IDBRequestAttemptError("add", this._qt, err, [item, key]);
        }
    }

    get(key: IDBValidKey | IDBKeyRange): IDBRequest<T | null> {
        try {
            LOG_REQUESTS && logRequest("get", [key], this._qt);
            return this._qt.get(key);
        } catch(err) {
            throw new IDBRequestAttemptError("get", this._qt, err, [key]);
        }
    }
    
    getKey(key: IDBValidKey | IDBKeyRange): IDBRequest<IDBValidKey | undefined> {
        try {
            LOG_REQUESTS && logRequest("getKey", [key], this._qt);
            return this._qt.getKey(key)
        } catch(err) {
            throw new IDBRequestAttemptError("getKey", this._qt, err, [key]);
        }
    }

    delete(key: IDBValidKey | IDBKeyRange): IDBRequest<undefined> {
        try {
            LOG_REQUESTS && logRequest("delete", [key], this._qt);
            return this._qtStore.delete(key);
        } catch(err) {
            throw new IDBRequestAttemptError("delete", this._qt, err, [key]);
        }
    }

    index(name: string): IDBIndex {
        try {
            return this._qtStore.index(name);
        } catch(err) {
            // TODO: map to different error? this is not a request
            throw new IDBRequestAttemptError("index", this._qt, err, [name]);
        }
    }
}

export class Store<T> extends QueryTarget<T> {
    private _transaction: Transaction;

    constructor(idbStore: IDBObjectStore, transaction: Transaction) {
        super(new QueryTargetWrapper<T>(idbStore));
        this._transaction = transaction;
    }

    get IDBKeyRange() {
        // @ts-ignore
        return this._transaction.IDBKeyRange;
    }

    get _idbStore(): QueryTargetWrapper<T> {
        return (this._target as QueryTargetWrapper<T>);
    }

    index(indexName: string): QueryTarget<T> {
        return new QueryTarget<T>(new QueryTargetWrapper<T>(this._idbStore.index(indexName)));
    }

    put(value: T, log?: LogItem): void {
        // If this request fails, the error will bubble up to the transaction and abort it,
        // which is the behaviour we want. Therefore, it is ok to not create a promise for this
        // request and await it.
        // 
        // Perhaps at some later point, we will want to handle an error (like ConstraintError) for
        // individual write requests. In that case, we should add a method that returns a promise (e.g. putAndObserve)
        // and call preventDefault on the event to prevent it from aborting the transaction
        // 
        // Note that this can still throw synchronously, like it does for TransactionInactiveError,
        // see https://www.w3.org/TR/IndexedDB-2/#transaction-lifetime-concept
        const request = this._idbStore.put(value);
        this._prepareErrorLog(request, log, "put", undefined, value);
    }

    add(value: T, log?: LogItem): void {
        // ok to not monitor result of request, see comment in `put`.
        const request = this._idbStore.add(value);
        this._prepareErrorLog(request, log, "add", undefined, value);
    }

    delete(keyOrKeyRange: IDBValidKey | IDBKeyRange, log?: LogItem): void {
        // ok to not monitor result of request, see comment in `put`.
        const request = this._idbStore.delete(keyOrKeyRange);
        this._prepareErrorLog(request, log, "delete", keyOrKeyRange, undefined);
    }

    private _prepareErrorLog(request: IDBRequest, log: LogItem | undefined, operationName: string, key: IDBValidKey | IDBKeyRange | undefined, value: T | undefined) {
        if (log) {
            log.ensureRefId();
        }
        reqAsPromise(request).catch(err => {
            try {
                if (!key && value) {
                    key = this._getKey(value);
                }
            } catch {
                key = "getKey failed";
            }
            this._transaction.addWriteError(err, log, operationName, key);
        });
    }

    private _getKey(value: T): IDBValidKey {
        const {keyPath} = this._idbStore;
        if (Array.isArray(keyPath)) {
            let field: any = value;
            for (const part of keyPath) {
                if (typeof field === "object") {
                    field = field[part];
                } else {
                    break;
                }
            }
            return field as IDBValidKey;
        } else {
            return value[keyPath] as IDBValidKey;
        }        
    }
}
