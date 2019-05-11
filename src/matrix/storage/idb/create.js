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
    db.createObjectStore("timelineFragments", {keyPath: ["roomId", "id"]});
    // needs roomId separate because it might hold a gap and no event
    const timelineEvents = db.createObjectStore("timelineEvents", {keyPath: ["event.room_id", "fragmentId", "eventIndex"]});
    timelineEvents.createIndex("byEventId", [
        "event.room_id",
        "event.event_id"
    ], {unique: true});

    db.createObjectStore("roomState", {keyPath: [
        "roomId",
        "event.type",
        "event.state_key"
    ]});
    
    // const roomMembers = db.createObjectStore("roomMembers", {keyPath: [
    //  "event.room_id",
    //  "event.content.membership",
    //  "event.state_key"
    // ]});
    // roomMembers.createIndex("byName", ["room_id", "content.name"]);
}
