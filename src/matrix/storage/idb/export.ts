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
