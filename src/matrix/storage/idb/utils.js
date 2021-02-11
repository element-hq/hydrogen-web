/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { IDBRequestError } from "./error.js";
import { StorageError } from "../common.js";

let needsSyncPromise = false;

/* should be called on legacy platforms to see
   if transactions close before draining the microtask queue (IE11 on Windows 7).
   If this is the case, promises need to be resolved
   synchronously from the idb request handler to prevent the transaction from closing prematurely.
*/
export async function checkNeedsSyncPromise() {
    // important to have it turned off while doing the test,
    // otherwise reqAsPromise would not fail
    needsSyncPromise = false;
    const NAME = "test-idb-needs-sync-promise";
    const db = await openDatabase(NAME, db => {
        db.createObjectStore("test", {keyPath: "key"});
    }, 1);
    const txn = db.transaction("test", "readonly");
    try {
        await reqAsPromise(txn.objectStore("test").get(1));
        await reqAsPromise(txn.objectStore("test").get(2));
    } catch (err) {
        // err.name would be either TransactionInactiveError or InvalidStateError,
        // but let's not exclude any other failure modes
        needsSyncPromise = true;
    }
    // we could delete the store here, 
    // but let's not create it on every page load on legacy platforms,
    // and just keep it around
    return needsSyncPromise;
}

// storage keys are defined to be unsigned 32bit numbers in KeyLimits, which is assumed by idb
export function encodeUint32(n) {
    const hex = n.toString(16);
    return "0".repeat(8 - hex.length) + hex;
}

export function decodeUint32(str) {
    return parseInt(str, 16);
}

export function openDatabase(name, createObjectStore, version) {
    const req = indexedDB.open(name, version);
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
        req.addEventListener("success", event => {
            resolve(event.target.result);
            needsSyncPromise && Promise._flush && Promise._flush();
        });
        req.addEventListener("error", () => {
            reject(new IDBRequestError(req));
            needsSyncPromise && Promise._flush && Promise._flush();
        });
    });
}

export function txnAsPromise(txn) {
    return new Promise((resolve, reject) => {
        txn.addEventListener("complete", () => {
            resolve();
            needsSyncPromise && Promise._flush && Promise._flush();
        });
        txn.addEventListener("abort", () => {
            reject(new IDBRequestError(txn));
            needsSyncPromise && Promise._flush && Promise._flush();
        });
    });
}

export function iterateCursor(cursorRequest, processValue) {
    // TODO: does cursor already have a value here??
    return new Promise((resolve, reject) => {
        cursorRequest.onerror = () => {
            reject(new IDBRequestError(cursorRequest));
            needsSyncPromise && Promise._flush && Promise._flush();
        };
        // collect results
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(false);
                needsSyncPromise && Promise._flush && Promise._flush();
                return; // end of results
            }
            const result = processValue(cursor.value, cursor.key, cursor);
            // TODO: don't use object for result and assume it's jumpTo when not === true/false or undefined
            const done = result?.done;
            const jumpTo = result?.jumpTo;

            if (done) {
                resolve(true);
                needsSyncPromise && Promise._flush && Promise._flush();
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
