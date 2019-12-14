import { iterateCursor, txnAsPromise } from "./utils.js";
import { STORE_NAMES } from "../common.js";

export async function exportSession(db) {
    const NOT_DONE = {done: false};
    const txn = db.transaction(STORE_NAMES, "readonly");
    const data = {};
    await Promise.all(STORE_NAMES.map(async name => {
        const results = data[name] = [];  // initialize in deterministic order
        const store = txn.objectStore(name);
        await iterateCursor(store.openCursor(), (value) => {
            results.push(value);
            return NOT_DONE;
        });
    }));
    return data;
}

export async function importSession(db, data) {
    const txn = db.transaction(STORE_NAMES, "readwrite");
    for (const name of STORE_NAMES) {
        const store = txn.objectStore(name);
        for (const value of data[name]) {
            store.add(value);
        }
    }
    await txnAsPromise(txn);
}
