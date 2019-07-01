import Storage from "./storage.js";
import { openDatabase } from "./utils.js";

export default async function createIdbStorage(databaseName) {
    const db = await openDatabase(databaseName, createStores, 1);
    return new Storage(db);
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
