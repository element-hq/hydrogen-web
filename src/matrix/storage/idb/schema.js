import {iterateCursor} from "./utils.js";
import {RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../room/RoomMember.js";
import {RoomMemberStore} from "./stores/RoomMemberStore.js";

// FUNCTIONS SHOULD ONLY BE APPENDED!!
// the index in the array is the database version
export const schema = [
    createInitialStores,
    createMemberStore,
];
// TODO: how to deal with git merge conflicts of this array?


// how do we deal with schema updates vs existing data migration in a way that 
//v1
function createInitialStores(db) {
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
}
//v2
async function createMemberStore(db, txn) {
    const roomMembers = new RoomMemberStore(db.createObjectStore("roomMembers", {keyPath: "key"}));
    // migrate existing member state events over
    const roomState = txn.objectStore("roomState");
    await iterateCursor(roomState.openCursor(), entry => {
        if (entry.event.type === MEMBER_EVENT_TYPE) {
            roomState.delete(entry.key);
            const member = RoomMember.fromMemberEvent(entry.roomId, entry.event);
            if (member) {
                roomMembers.set(member.serialize());
            }
        }
    });
}
