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

import {QueryTarget} from "./QueryTarget.js";
import {IDBRequestAttemptError} from "./error.js";

const LOG_REQUESTS = false;

function logRequest(method, params, source) {
    const storeName = source?.name;
    const databaseName = source?.transaction?.db?.name;
    console.info(`${databaseName}.${storeName}.${method}(${params.map(p => JSON.stringify(p)).join(", ")})`);
}

class QueryTargetWrapper {
    constructor(qt) {
        this._qt = qt;
    }

    get keyPath() {
        if (this._qt.objectStore) {
            return this._qt.objectStore.keyPath;
        } else {
            return this._qt.keyPath;
        }
    }

    supports(methodName) {
        return !!this._qt[methodName];
    }
    
    openKeyCursor(...params) {
        try {
            // not supported on Edge 15
            if (!this._qt.openKeyCursor) {
                LOG_REQUESTS && logRequest("openCursor", params, this._qt);
                return this.openCursor(...params);
            }
            LOG_REQUESTS && logRequest("openKeyCursor", params, this._qt);
            return this._qt.openKeyCursor(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("openKeyCursor", this._qt, err, params);
        }
    }
    
    openCursor(...params) {
        try {
            LOG_REQUESTS && logRequest("openCursor", params, this._qt);
            return this._qt.openCursor(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("openCursor", this._qt, err, params);
        }
    }

    put(...params) {
        try {
            LOG_REQUESTS && logRequest("put", params, this._qt);
            return this._qt.put(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("put", this._qt, err, params);
        }
    }

    add(...params) {
        try {
            LOG_REQUESTS && logRequest("add", params, this._qt);
            return this._qt.add(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("add", this._qt, err, params);
        }
    }

    get(...params) {
        try {
            LOG_REQUESTS && logRequest("get", params, this._qt);
            return this._qt.get(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("get", this._qt, err, params);
        }
    }
    
    getKey(...params) {
        try {
            LOG_REQUESTS && logRequest("getKey", params, this._qt);
            return this._qt.getKey(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("getKey", this._qt, err, params);
        }
    }

    delete(...params) {
        try {
            LOG_REQUESTS && logRequest("delete", params, this._qt);
            return this._qt.delete(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("delete", this._qt, err, params);
        }
    }

    index(...params) {
        try {
            return this._qt.index(...params);
        } catch(err) {
            // TODO: map to different error? this is not a request
            throw new IDBRequestAttemptError("index", this._qt, err, params);
        }
    }
}

export class Store extends QueryTarget {
    constructor(idbStore, transaction) {
        super(new QueryTargetWrapper(idbStore));
        this._transaction = transaction;
    }

    get IDBKeyRange() {
        return this._transaction.IDBKeyRange;
    }

    get _idbStore() {
        return this._target;
    }

    index(indexName) {
        return new QueryTarget(new QueryTargetWrapper(this._idbStore.index(indexName)));
    }

    put(value) {
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
        this._idbStore.put(value);
    }

    add(value) {
        // ok to not monitor result of request, see comment in `put`.
        this._idbStore.add(value);
    }

    delete(keyOrKeyRange) {
        // ok to not monitor result of request, see comment in `put`.
        this._idbStore.delete(keyOrKeyRange);
    }
}
