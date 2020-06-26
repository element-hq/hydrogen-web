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
