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

import { StorageError } from "../common.js";

class WrappedDOMException extends StorageError {
    constructor(request) {
        const source = request?.source;
        const storeName = source?.name || "<unknown store>";
        const databaseName = source?.transaction?.db?.name || "<unknown db>";
        super(`Failed IDBRequest on ${databaseName}.${storeName}`, request.error);
        this.storeName = storeName;
        this.databaseName = databaseName;
    }
}

// storage keys are defined to be unsigned 32bit numbers in WebPlatform.js, which is assumed by idb
export function encodeUint32(n) {
    const hex = n.toString(16);
    return "0".repeat(8 - hex.length) + hex;
}

export function decodeUint32(str) {
    return parseInt(str, 16);
}

export function openDatabase(name, createObjectStore, version) {
    const req = window.indexedDB.open(name, version);
    req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        const txn = ev.target.transaction;
        const oldVersion = ev.oldVersion;
        createObjectStore(db, txn, oldVersion, version);
    }; 
    return reqAsPromise(req);
}

export function reqAsPromise(req) {
    return new Promise((resolve, reject) => {
        req.addEventListener("success", event => resolve(event.target.result));
        req.addEventListener("error", event => reject(new WrappedDOMException(event.target)));
    });
}

export function txnAsPromise(txn) {
    return new Promise((resolve, reject) => {
        txn.addEventListener("complete", resolve);
        txn.addEventListener("abort", event => reject(new WrappedDOMException(event.target)));
    });
}

export function iterateCursor(cursorRequest, processValue) {
    // TODO: does cursor already have a value here??
    return new Promise((resolve, reject) => {
        cursorRequest.onerror = () => {
            reject(new StorageError("Query failed", cursorRequest.error));
        };
        // collect results
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(false);
                return; // end of results
            }
            const result = processValue(cursor.value, cursor.key);
            const done = result && result.done;
            const jumpTo = result && result.jumpTo;

            if (done) {
                resolve(true);
            } else if(jumpTo) {
                cursor.continue(jumpTo);
            } else {
                cursor.continue();
            }
        };
    }).catch(err => {
        throw new StorageError("iterateCursor failed", err);
    });
}

export async function fetchResults(cursor, isDone) {
    const results = [];
    await iterateCursor(cursor, (value) => {
        results.push(value);
        return {done: isDone(results)};
    });
    return results;
}

export async function select(db, storeName, toCursor, isDone) {
    if (!isDone) {
        isDone = () => false;
    }
    if (!toCursor) {
        toCursor = store => store.openCursor();
    }
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const cursor = toCursor(store);
    return await fetchResults(cursor, isDone);
}

export async function updateSingletonStore(db, storeName, value) {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const cursor = await reqAsPromise(store.openCursor());
    if (cursor) {
        return reqAsPromise(cursor.update(storeName));
    } else {
        return reqAsPromise(store.add(value));
    }
}

export async function findStoreValue(db, storeName, toCursor, matchesValue) {
    if (!matchesValue) {
        matchesValue = () => true;
    }
    if (!toCursor) {
        toCursor = store => store.openCursor();
    }

    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const cursor = await reqAsPromise(toCursor(store));
    let match;
    const matched = await iterateCursor(cursor, (value) => {
        if (matchesValue(value)) {
            match = value;
            return true;
        }
    });
    if (!matched) {
        throw new StorageError("Value not found");
    }
    return match;
}
