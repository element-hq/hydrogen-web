export function openDatabase(name, createObjectStore, version = undefined) {
    const req = window.indexedDB.open(name, version);
    req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        const oldVersion = ev.oldVersion;
        createObjectStore(db, oldVersion, version);
    }; 
    return reqAsPromise(req);
}

export function reqAsPromise(req) {
    return new Promise((resolve, reject) => {
        req.addEventListener("success", event => resolve(event.target.result));
        req.addEventListener("error", event => reject(event.target.error));
    });
}

export function txnAsPromise(txn) {
    return new Promise((resolve, reject) => {
        txn.addEventListener("complete", resolve);
        txn.addEventListener("abort", reject);
    });
}

export function iterateCursor(cursor, processValue) {
    // TODO: does cursor already have a value here??
    return new Promise((resolve, reject) => {
        cursor.onerror = (event) => {
            reject(new Error("Query failed: " + event.target.errorCode));
        };
        // collect results
        cursor.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(false);
                return; // end of results
            }
            const isDone = processValue(cursor.value);
            if (isDone) {
                resolve(true);
            } else {
                cursor.continue();
            }
        };
    });
}

export async function fetchResults(cursor, isDone) {
    const results = [];
    await iterateCursor(cursor, (value) => {
        results.push(value);
        return isDone(results);
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
        throw new Error("Value not found");
    }
    return match;
}