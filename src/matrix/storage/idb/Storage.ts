/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {IDOMStorage} from "./types";
import {Transaction} from "./Transaction";
import { STORE_NAMES, StoreNames, StorageError } from "../common";
import { reqAsPromise } from "./utils";
import { ILogger } from "../../../logging/types";

const WEBKITEARLYCLOSETXNBUG_BOGUS_KEY = "782rh281re38-boguskey";

export class Storage {
    private _db: IDBDatabase;
    private _hasWebkitEarlyCloseTxnBug: boolean;

    readonly logger: ILogger;
    readonly idbFactory: IDBFactory
    readonly IDBKeyRange: typeof IDBKeyRange;
    readonly storeNames: typeof StoreNames;
    readonly localStorage: IDOMStorage;

    constructor(idbDatabase: IDBDatabase, idbFactory: IDBFactory, _IDBKeyRange: typeof IDBKeyRange, hasWebkitEarlyCloseTxnBug: boolean, localStorage: IDOMStorage, logger: ILogger) {
        this._db = idbDatabase;
        this.idbFactory = idbFactory;
        this.IDBKeyRange = _IDBKeyRange;
        this._hasWebkitEarlyCloseTxnBug = hasWebkitEarlyCloseTxnBug;
        this.storeNames = StoreNames;
        this.localStorage = localStorage;
        this.logger = logger;
    }

    _validateStoreNames(storeNames: StoreNames[]): void {
        const idx = storeNames.findIndex(name => !STORE_NAMES.includes(name));
        if (idx !== -1) {
            throw new StorageError(`Tried top, a transaction unknown store ${storeNames[idx]}`);
        }
    }

    async readTxn(storeNames: StoreNames[]): Promise<Transaction> {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readonly");
            // https://bugs.webkit.org/show_bug.cgi?id=222746 workaround,
            // await a bogus idb request on the new txn so it doesn't close early if we await a microtask first
            if (this._hasWebkitEarlyCloseTxnBug) {
                await reqAsPromise(txn.objectStore(storeNames[0]).get(WEBKITEARLYCLOSETXNBUG_BOGUS_KEY));
            }
            return new Transaction(txn, storeNames, this);
        } catch(err) {
            throw new StorageError("readTxn failed", err);
        }
    }

    async readWriteTxn(storeNames: StoreNames[]): Promise<Transaction> {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readwrite");
            // https://bugs.webkit.org/show_bug.cgi?id=222746 workaround,
            // await a bogus idb request on the new txn so it doesn't close early if we await a microtask first
            if (this._hasWebkitEarlyCloseTxnBug) {
                await reqAsPromise(txn.objectStore(storeNames[0]).get(WEBKITEARLYCLOSETXNBUG_BOGUS_KEY));
            }
            return new Transaction(txn, storeNames, this);
        } catch(err) {
            throw new StorageError("readWriteTxn failed", err);
        }
    }

    close(): void {
        this._db.close();
    }

    get databaseName(): string {
        return this._db.name;
    }
}
