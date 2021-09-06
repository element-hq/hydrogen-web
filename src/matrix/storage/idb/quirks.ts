/*
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


import {openDatabase, txnAsPromise, reqAsPromise} from "./utils";

// filed as https://bugs.webkit.org/show_bug.cgi?id=222746
export async function detectWebkitEarlyCloseTxnBug(idbFactory: IDBFactory): Promise<boolean> {
    const dbName = "hydrogen_webkit_test_inactive_txn_bug";
    try {
        const db = await openDatabase(dbName, db => {
            db.createObjectStore("test", {keyPath: "key"});
        }, 1, idbFactory);
        const readTxn = db.transaction(["test"], "readonly");
        await reqAsPromise(readTxn.objectStore("test").get("somekey"));
        // schedule a macro task in between the two txns
        await new Promise(r => setTimeout(r, 0));
        const writeTxn = db.transaction(["test"], "readwrite");
        await Promise.resolve();
        writeTxn.objectStore("test").add({key: "somekey", value: "foo"});
        await txnAsPromise(writeTxn);
        db.close();
    } catch (err) {
        if (err.name === "TransactionInactiveError") {
            return true;
        }
    }
    return false;
}
