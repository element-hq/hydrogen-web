/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {IDOMStorage} from "./types";
import {Storage} from "./Storage";
import {openDatabase, reqAsPromise} from "./utils";
import {exportSession, importSession, Export} from "./export";
import {schema} from "./schema";
import {detectWebkitEarlyCloseTxnBug} from "./quirks";
import {ILogItem} from "../../../logging/types";
import {clearKeysFromLocalStorage} from "./stores/SessionStore";

const sessionName = (sessionId: string) => `hydrogen_session_${sessionId}`;
const openDatabaseWithSessionId = function(sessionId: string, idbFactory: IDBFactory, localStorage: IDOMStorage, log: ILogItem) {
    const create = (db, txn, oldVersion, version) => createStores(db, txn, oldVersion, version, localStorage, log);
    return openDatabase(sessionName(sessionId), create, schema.length, idbFactory);
}

interface ServiceWorkerHandler {
    preventConcurrentSessionAccess: (sessionId: string) => Promise<void>;
}

async function requestPersistedStorage(): Promise<boolean> {
    // don't assume browser so we can run in node with fake-idb
    const glob = this;
    if (glob?.navigator?.storage?.persist) {
        return await glob.navigator.storage.persist();
    } else if (glob?.document.requestStorageAccess) {
        try {
            await glob.document.requestStorageAccess();
            return true;
        } catch (err) {
            console.warn("requestStorageAccess threw an error:", err);
            return false;
        }
    } else {
        return false;
    }
}

export class StorageFactory {
    private _serviceWorkerHandler: ServiceWorkerHandler;
    private _idbFactory: IDBFactory;
    private _IDBKeyRange: typeof IDBKeyRange;
    private _localStorage: IDOMStorage;

    constructor(serviceWorkerHandler: ServiceWorkerHandler, idbFactory: IDBFactory = window.indexedDB, _IDBKeyRange = window.IDBKeyRange, localStorage: IDOMStorage = window.localStorage) {
        this._serviceWorkerHandler = serviceWorkerHandler;
        this._idbFactory = idbFactory;
        this._IDBKeyRange = _IDBKeyRange;
        this._localStorage = localStorage;
    }

    async create(sessionId: string, log: ILogItem): Promise<Storage> {
        await this._serviceWorkerHandler?.preventConcurrentSessionAccess(sessionId);
        requestPersistedStorage().then(persisted => {
            // Firefox lies here though, and returns true even if the user denied the request
            if (!persisted) {
                log.log("no persisted storage, database can be evicted by browser", log.level.Warn);
            }
        });

        const hasWebkitEarlyCloseTxnBug = await detectWebkitEarlyCloseTxnBug(this._idbFactory);
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, this._localStorage, log);
        return new Storage(db, this._idbFactory, this._IDBKeyRange, hasWebkitEarlyCloseTxnBug, this._localStorage, log.logger);
    }

    async delete(sessionId: string): Promise<void> {
        const databaseName = sessionName(sessionId);
        try {
            clearKeysFromLocalStorage(this._localStorage, databaseName);
        } catch (e) {}
        try {
            const req = this._idbFactory.deleteDatabase(databaseName);
            await reqAsPromise(req);
        } catch (e) {}
    }

    async export(sessionId: string, log: ILogItem): Promise<Export> {
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, this._localStorage, log);
        return await exportSession(db);
    }

    async import(sessionId: string, data: Export, log: ILogItem): Promise<void> {
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, this._localStorage, log);
        return await importSession(db, data);
    }
}

async function createStores(db: IDBDatabase, txn: IDBTransaction, oldVersion: number | null, version: number, localStorage: IDOMStorage, log: ILogItem): Promise<void> {
    const startIdx = oldVersion || 0;
    return log.wrap(
        { l: "storage migration", oldVersion, version },
        async (log) => {
            for (let i = startIdx; i < version; ++i) {
                const migrationFunc = schema[i];
                await log.wrap(`v${i + 1}`, (log) => migrationFunc(db, txn, localStorage, log));
            }
        });
}
