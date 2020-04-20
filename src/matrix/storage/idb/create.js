import {Storage} from "./storage.js";
import { openDatabase, reqAsPromise } from "./utils.js";
import { exportSession, importSession } from "./export.js";

const sessionName = sessionId => `brawl_session_${sessionId}`;
const openDatabaseWithSessionId = sessionId => openDatabase(sessionName(sessionId), createStores, 1);

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

function createStores(db) {
    db.createObjectStore("session", {keyPath: "key"});
    // any way to make keys unique here? (just use put?)
    db.createObjectStore("roomSummary", {keyPath: "roomId"});

    // need index to find live fragment? prooobably ok without for now
    //key = room_id | fragment_id
    db.createObjectStore("timelineFragments", {keyPath: "key"});
    //key = room_id | fragment_id | event_index
    const timelineEvents = db.createObjectStore("timelineEvents", {keyPath: "key"});
    //eventIdKey = room_id | event_id
    timelineEvents.createIndex("byEventId", "eventIdKey", {unique: true});
    //key = room_id | event.type | event.state_key,
    db.createObjectStore("roomState", {keyPath: "key"});
    db.createObjectStore("pendingEvents", {keyPath: "key"});
    
    // const roomMembers = db.createObjectStore("roomMembers", {keyPath: [
    //  "event.room_id",
    //  "event.content.membership",
    //  "event.state_key"
    // ]});
    // roomMembers.createIndex("byName", ["room_id", "content.name"]);
}
