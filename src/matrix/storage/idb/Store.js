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
import { reqAsPromise } from "./utils.js";
import { StorageError } from "../common.js";

class QueryTargetWrapper {
    constructor(qt) {
        this._qt = qt;
    }

    supports(methodName) {
        return !!this._qt[methodName];
    }
    
    openKeyCursor(...params) {
        // not supported on Edge 15
        if (!this._qt.openKeyCursor) {
            return this.openCursor(...params);
        }
        try {
            return this._qt.openKeyCursor(...params);
        } catch(err) {
            throw new StorageError("openKeyCursor failed", err);
        }
    }
    
    openCursor(...params) {
        try {
            return this._qt.openCursor(...params);
        } catch(err) {
            throw new StorageError("openCursor failed", err);
        }
    }

    put(...params) {
        try {
            return this._qt.put(...params);
        } catch(err) {
            throw new StorageError("put failed", err);
        }
    }

    add(...params) {
        try {
            return this._qt.add(...params);
        } catch(err) {
            throw new StorageError("add failed", err);
        }
    }

    get(...params) {
        try {
            return this._qt.get(...params);
        } catch(err) {
            throw new StorageError("get failed", err);
        }
    }
    
    getKey(...params) {
        try {
            return this._qt.getKey(...params);
        } catch(err) {
            throw new StorageError("getKey failed", err);
        }
    }

    delete(...params) {
        try {
            return this._qt.delete(...params);
        } catch(err) {
            throw new StorageError("delete failed", err);
        }
    }

    index(...params) {
        try {
            return this._qt.index(...params);
        } catch(err) {
            throw new StorageError("index failed", err);
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
