/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
