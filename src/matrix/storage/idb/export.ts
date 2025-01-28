/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { iterateCursor, NOT_DONE, txnAsPromise } from "./utils";
import { STORE_NAMES, StoreNames } from "../common";

export type Export = { [storeName in StoreNames] : any[] }

export async function exportSession(db: IDBDatabase): Promise<Export> {
    const txn = db.transaction(STORE_NAMES, "readonly");
    const data = {};
    await Promise.all(STORE_NAMES.map(async name => {
        const results: any[] = data[name] = [];  // initialize in deterministic order
        const store = txn.objectStore(name);
        await iterateCursor<any>(store.openCursor(), (value) => {
            results.push(value);
            return NOT_DONE;
        });
    }));
    return data as Export;
}

export async function importSession(db: IDBDatabase, data: Export): Promise<void> {
    const txn = db.transaction(STORE_NAMES, "readwrite");
    for (const name of STORE_NAMES) {
        const store = txn.objectStore(name);
        for (const value of data[name]) {
            store.add(value);
        }
    }
    await txnAsPromise(txn);
}
