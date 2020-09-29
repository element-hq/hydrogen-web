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
import {reqAsPromise} from "./utils.js";
import {StorageError} from "../common.js";

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
                return this.openCursor(...params);
            }
            return this._qt.openKeyCursor(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("openKeyCursor", this._qt, err, params);
        }
    }
    
    openCursor(...params) {
        try {
            return this._qt.openCursor(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("openCursor", this._qt, err, params);
        }
    }

    put(...params) {
        try {
            return this._qt.put(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("put", this._qt, err, params);
        }
    }

    add(...params) {
        try {
            return this._qt.add(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("add", this._qt, err, params);
        }
    }

    get(...params) {
        try {
            return this._qt.get(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("get", this._qt, err, params);
        }
    }
    
    getKey(...params) {
        try {
            return this._qt.getKey(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("getKey", this._qt, err, params);
        }
    }

    delete(...params) {
        try {
            return this._qt.delete(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("delete", this._qt, err, params);
        }
    }

    index(...params) {
        try {
            return this._qt.index(...params);
        } catch(err) {
            throw new IDBRequestAttemptError("index", this._qt, err, params);
        }
    }
}

export class Store extends QueryTarget {
    constructor(idbStore) {
        super(new QueryTargetWrapper(idbStore));
    }

    get _idbStore() {
        return this._target;
    }

    index(indexName) {
        return new QueryTarget(new QueryTargetWrapper(this._idbStore.index(indexName)));
    }

    async put(value) {
        try {
            return await reqAsPromise(this._idbStore.put(value));
        } catch(err) {
            const originalErr = err.cause;
            throw new StorageError(`put on ${err.databaseName}.${err.storeName} failed`, originalErr, value);
        }
    }

    async add(value) {
        try {
            // this will catch both the sync error already mapped 
            // in the QueryTargetWrapper above, and also the async request errors, which are still DOMException's
            return await reqAsPromise(this._idbStore.add(value));
        } catch(err) {
            const originalErr = err.cause;
            throw new StorageError(`add on ${err.databaseName}.${err.storeName} failed`, originalErr, value);
        }
    }

    async delete(keyOrKeyRange) {
        try {
            return await reqAsPromise(this._idbStore.delete(keyOrKeyRange));
        } catch(err) {
            const originalErr = err.cause;
            throw new StorageError(`delete on ${err.databaseName}.${err.storeName} failed`, originalErr, keyOrKeyRange);
        }
        
    }
}
