import {iterateCursor, reqAsPromise} from "./utils.js";
import {RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../room/members/RoomMember.js";
import {addRoomToIdentity} from "../../e2ee/DeviceTracker.js";
import {RoomMemberStore} from "./stores/RoomMemberStore.js";
import {SessionStore} from "./stores/SessionStore.js";
import {encodeScopeTypeKey} from "./stores/OperationStore.js";
import {MAX_UNICODE} from "./stores/common.js";

// FUNCTIONS SHOULD ONLY BE APPENDED!!
// the index in the array is the database version
export const schema = [
    createInitialStores,
    createMemberStore,
    migrateSession,
    createE2EEStores,
    migrateEncryptionFlag,
    createAccountDataStore,
    createInviteStore,
    createArchivedRoomSummaryStore,
    migrateOperationScopeIndex,
    createTimelineRelationsStore,
    fixMissingRoomsInUserIdentities
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
//v3
async function migrateSession(db, txn) {
    const session = txn.objectStore("session");
    try {
        const PRE_MIGRATION_KEY = 1;
        const entry = await reqAsPromise(session.get(PRE_MIGRATION_KEY));
        if (entry) {
            session.delete(PRE_MIGRATION_KEY);
            const {syncToken, syncFilterId, serverVersions} = entry.value;
            const store = new SessionStore(session);
            store.set("sync", {token: syncToken, filterId: syncFilterId});
            store.set("serverVersions", serverVersions);
        }
    } catch (err) {
        txn.abort();
        console.error("could not migrate session", err.stack);
    }
}
//v4
function createE2EEStores(db) {
    db.createObjectStore("userIdentities", {keyPath: "userId"});
    const deviceIdentities = db.createObjectStore("deviceIdentities", {keyPath: "key"});
    deviceIdentities.createIndex("byCurve25519Key", "curve25519Key", {unique: true});
    db.createObjectStore("olmSessions", {keyPath: "key"});
    db.createObjectStore("inboundGroupSessions", {keyPath: "key"});
    db.createObjectStore("outboundGroupSessions", {keyPath: "roomId"});
    db.createObjectStore("groupSessionDecryptions", {keyPath: "key"});
    const operations = db.createObjectStore("operations", {keyPath: "id"});
    operations.createIndex("byTypeAndScope", "typeScopeKey", {unique: false});
}

// v5
async function migrateEncryptionFlag(db, txn) {
    // migrate room summary isEncrypted -> encryption prop
    const roomSummary = txn.objectStore("roomSummary");
    const roomState = txn.objectStore("roomState");
    const summaries = [];
    await iterateCursor(roomSummary.openCursor(), summary => {
        summaries.push(summary);
    });
    for (const summary of summaries) {
        const encryptionEntry = await reqAsPromise(roomState.get(`${summary.roomId}|m.room.encryption|`));
        if (encryptionEntry) {
            summary.encryption = encryptionEntry?.event?.content;
            delete summary.isEncrypted;
            roomSummary.put(summary);
        }
    }
}

// v6
function createAccountDataStore(db) {
    db.createObjectStore("accountData", {keyPath: "type"});
}

// v7
function createInviteStore(db) {
    db.createObjectStore("invites", {keyPath: "roomId"});
}

// v8
function createArchivedRoomSummaryStore(db) {
    db.createObjectStore("archivedRoomSummary", {keyPath: "summary.roomId"});
}

// v9
async function migrateOperationScopeIndex(db, txn) {
    try {
        const operations = txn.objectStore("operations");
        operations.deleteIndex("byTypeAndScope");
        await iterateCursor(operations.openCursor(), (op, key, cur) => {
            const {typeScopeKey} = op;
            delete op.typeScopeKey;
            const [type, scope] = typeScopeKey.split("|");
            op.scopeTypeKey = encodeScopeTypeKey(scope, type);
            cur.update(op);
        });
        operations.createIndex("byScopeAndType", "scopeTypeKey", {unique: false});
    } catch (err) {
        txn.abort();
        console.error("could not migrate operations", err.stack);
    }
}

//v10
function createTimelineRelationsStore(db) {
    db.createObjectStore("timelineRelations", {keyPath: "key"});
}

//v11 doesn't change the schema, but ensures all userIdentities have all the roomIds they should (see #470)
async function fixMissingRoomsInUserIdentities(db, txn, log) {
    const roomSummaryStore = txn.objectStore("roomSummary");
    const trackedRoomIds = [];
    await iterateCursor(roomSummaryStore.openCursor(), roomSummary => {
        if (roomSummary.isTrackingMembers) {
            trackedRoomIds.push(roomSummary.roomId);
        }
    });
    const outboundGroupSessionsStore = txn.objectStore("outboundGroupSessions");
    const userIdentitiesStore = txn.objectStore("userIdentities");
    const roomMemberStore = txn.objectStore("roomMembers");
    for (const roomId of trackedRoomIds) {
        let foundMissing = false;
        const joinedUserIds = [];
        const memberRange = IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
        await log.wrap({l: "room", id: roomId}, async log => {
            await iterateCursor(roomMemberStore.openCursor(memberRange), member => {
                if (member.membership === "join") {
                    joinedUserIds.push(member.userId);
                }
            });
            log.set("joinedUserIds", joinedUserIds.length);
            for (const userId of joinedUserIds) {
                const identity = await reqAsPromise(userIdentitiesStore.get(userId));
                const originalRoomCount = identity?.roomIds?.length;
                const updatedIdentity = addRoomToIdentity(identity, userId, roomId);
                if (updatedIdentity) {
                    log.log({l: `fixing up`, id: userId,
                        roomsBefore: originalRoomCount, roomsAfter: updatedIdentity.roomIds.length});
                    userIdentitiesStore.put(updatedIdentity);
                    foundMissing = true;
                }
            }
            log.set("foundMissing", foundMissing);
            if (foundMissing) {
                // clear outbound megolm session,
                // so we'll create a new one on the next message that will be properly shared
                outboundGroupSessionsStore.delete(roomId);
            }
        });
    }
}
