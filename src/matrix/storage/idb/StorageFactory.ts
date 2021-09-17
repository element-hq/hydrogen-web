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

import {Storage} from "./Storage";
import { openDatabase, reqAsPromise } from "./utils";
import { exportSession, importSession, Export } from "./export";
import { schema } from "./schema";
import { detectWebkitEarlyCloseTxnBug } from "./quirks";
import { BaseLogger } from "../../../logging/BaseLogger.js";
import { LogItem } from "../../../logging/LogItem.js";

const sessionName = (sessionId: string) => `hydrogen_session_${sessionId}`;
const openDatabaseWithSessionId = function(sessionId: string, idbFactory: IDBFactory, log: LogItem) {
    const create = (db, txn, oldVersion, version) => createStores(db, txn, oldVersion, version, log);
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
            return false;
        }
    } else {
        return false;
    }
}

export class StorageFactory {
    private _serviceWorkerHandler: ServiceWorkerHandler;
    private _idbFactory: IDBFactory;
    private _IDBKeyRange: typeof IDBKeyRange

    constructor(serviceWorkerHandler: ServiceWorkerHandler, idbFactory: IDBFactory = window.indexedDB, _IDBKeyRange = window.IDBKeyRange) {
        this._serviceWorkerHandler = serviceWorkerHandler;
        this._idbFactory = idbFactory;
        this._IDBKeyRange = _IDBKeyRange;
    }

    async create(sessionId: string, log: LogItem): Promise<Storage> {
        await this._serviceWorkerHandler?.preventConcurrentSessionAccess(sessionId);
        requestPersistedStorage().then(persisted => {
            // Firefox lies here though, and returns true even if the user denied the request
            if (!persisted) {
                console.warn("no persisted storage, database can be evicted by browser");
            }
        });

        const hasWebkitEarlyCloseTxnBug = await detectWebkitEarlyCloseTxnBug(this._idbFactory);
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, log);
        return new Storage(db, this._idbFactory, this._IDBKeyRange, hasWebkitEarlyCloseTxnBug, log.logger);
    }

    delete(sessionId: string): Promise<IDBDatabase> {
        const databaseName = sessionName(sessionId);
        const req = this._idbFactory.deleteDatabase(databaseName);
        return reqAsPromise(req);
    }

    async export(sessionId: string, log: LogItem): Promise<Export> {
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, log);
        return await exportSession(db);
    }

    async import(sessionId: string, data: Export, log: LogItem): Promise<void> {
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, log);
        return await importSession(db, data);
    }
}

async function createStores(db: IDBDatabase, txn: IDBTransaction, oldVersion: number | null, version: number, log: LogItem): Promise<void> {
    const startIdx = oldVersion || 0;
    return log.wrap({l: "storage migration", oldVersion, version}, async log => {
        for(let i = startIdx; i < version; ++i) {
            await log.wrap(`v${i + 1}`, log => schema[i](db, txn, log));
        }
    });
}
