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

import {Storage} from "./Storage.js";
import { openDatabase, reqAsPromise } from "./utils.js";
import { exportSession, importSession } from "./export.js";
import { schema } from "./schema.js";

const sessionName = sessionId => `brawl_session_${sessionId}`;
const openDatabaseWithSessionId = sessionId => openDatabase(sessionName(sessionId), createStores, schema.length);

export class StorageFactory {
    async create(sessionId) {
        const db = await openDatabaseWithSessionId(sessionId);
        return new Storage(db);
    }

    delete(sessionId) {
        const databaseName = sessionName(sessionId);
        const req = window.indexedDB.deleteDatabase(databaseName);
        return reqAsPromise(req);
    }

    async export(sessionId) {
        const db = await openDatabaseWithSessionId(sessionId);
        return await exportSession(db);
    }

    async import(sessionId, data) {
        const db = await openDatabaseWithSessionId(sessionId);
        return await importSession(db, data);
    }
}

async function createStores(db, txn, oldVersion, version) {
    const startIdx = oldVersion || 0;

    for(let i = startIdx; i < version; ++i) {
        await schema[i](db, txn);
    }
}
