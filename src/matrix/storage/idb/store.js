import QueryTarget from "./query-target.js";
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

export default class Store extends QueryTarget {
    constructor(idbStore) {
        super(new QueryTargetWrapper(idbStore));
    }

    get _idbStore() {
        return this._target;
    }

    index(indexName) {
        return new QueryTarget(new QueryTargetWrapper(this._idbStore.index(indexName)));
    }

    put(value) {
        return reqAsPromise(this._idbStore.put(value));
    }

    add(value) {
        return reqAsPromise(this._idbStore.add(value));
    }

    delete(keyOrKeyRange) {
        return reqAsPromise(this._idbStore.delete(keyOrKeyRange));
    }
}
