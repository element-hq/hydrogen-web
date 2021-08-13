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
import { exportSession, importSession } from "./export";
import { schema } from "./schema";
import { detectWebkitEarlyCloseTxnBug } from "./quirks";

const sessionName = (sessionId: string) => `hydrogen_session_${sessionId}`;
const openDatabaseWithSessionId = function(sessionId: string, idbFactory: IDBFactory): Promise<IDBDatabase> {
    return openDatabase(sessionName(sessionId), createStores, schema.length, idbFactory);
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

    constructor(serviceWorkerHandler: ServiceWorkerHandler, idbFactory: IDBFactory = window.indexedDB, IDBKeyRange = window.IDBKeyRange) {
        this._serviceWorkerHandler = serviceWorkerHandler;
        this._idbFactory = idbFactory;
        // @ts-ignore
        this._IDBKeyRange = IDBKeyRange;
    }

    async create(sessionId: string): Promise<Storage> {
        await this._serviceWorkerHandler?.preventConcurrentSessionAccess(sessionId);
        requestPersistedStorage().then(persisted => {
            // Firefox lies here though, and returns true even if the user denied the request
            if (!persisted) {
                console.warn("no persisted storage, database can be evicted by browser");
            }
        });

        const hasWebkitEarlyCloseTxnBug = await detectWebkitEarlyCloseTxnBug(this._idbFactory);
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory);
        // @ts-ignore
        return new Storage(db, this._IDBKeyRange, hasWebkitEarlyCloseTxnBug);
    }

    delete(sessionId: string): Promise<IDBDatabase> {
        const databaseName = sessionName(sessionId);
        const req = this._idbFactory.deleteDatabase(databaseName);
        return reqAsPromise(req);
    }

    async export(sessionId: string): Promise<{ [storeName: string]: any }> {
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory);
        return await exportSession(db);
    }

    async import(sessionId: string, data: { [storeName: string]: any }): Promise<void> {
        const db = await openDatabaseWithSessionId(sessionId, this._idbFactory);
        return await importSession(db, data);
    }
}

async function createStores(db: IDBDatabase, txn: IDBTransaction, oldVersion: number | null, version: number): Promise<void> {
    const startIdx = oldVersion || 0;

    for(let i = startIdx; i < version; ++i) {
        await schema[i](db, txn);
    }
}
