import {iterateCursor, NOT_DONE, reqAsPromise} from "./utils";
import {RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../room/members/RoomMember.js";
import {addRoomToIdentity} from "../../e2ee/DeviceTracker.js";
import {SummaryData} from "../../room/RoomSummary";
import {RoomMemberStore, MemberData} from "./stores/RoomMemberStore";
import {RoomStateEntry} from "./stores/RoomStateStore";
import {SessionStore} from "./stores/SessionStore";
import {encodeScopeTypeKey} from "./stores/OperationStore";
import {MAX_UNICODE} from "./stores/common";

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

// TypeScript note: for now, do not bother introducing interfaces / alias
// for old schemas. Just take them as `any`. 

// how do we deal with schema updates vs existing data migration in a way that 
//v1
function createInitialStores(db: IDBDatabase): void {
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
async function createMemberStore(db: IDBDatabase, txn: IDBTransaction): Promise<void> {
    // Cast ok here because only "set" is used
    const roomMembers = new RoomMemberStore(db.createObjectStore("roomMembers", {keyPath: "key"}) as any);
    // migrate existing member state events over
    const roomState = txn.objectStore("roomState");
    await iterateCursor<RoomStateEntry>(roomState.openCursor(), entry => {
        if (entry.event.type === MEMBER_EVENT_TYPE) {
            roomState.delete(entry.key);
            const member = RoomMember.fromMemberEvent(entry.roomId, entry.event);
            if (member) {
                roomMembers.set(member.serialize());
            }
        }
        return NOT_DONE;
    });
}
//v3
async function migrateSession(db: IDBDatabase, txn: IDBTransaction): Promise<void> {
    const session = txn.objectStore("session");
    try {
        const PRE_MIGRATION_KEY = 1;
        const entry = await reqAsPromise(session.get(PRE_MIGRATION_KEY));
        if (entry) {
            session.delete(PRE_MIGRATION_KEY);
            const {syncToken, syncFilterId, serverVersions} = entry.value;
            // Cast ok here because only "set" is used and we don't look into return
            const store = new SessionStore(session as any);
            store.set("sync", {token: syncToken, filterId: syncFilterId});
            store.set("serverVersions", serverVersions);
        }
    } catch (err) {
        txn.abort();
        console.error("could not migrate session", err.stack);
    }
}
//v4
function createE2EEStores(db: IDBDatabase): void {
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
async function migrateEncryptionFlag(db: IDBDatabase, txn: IDBTransaction): Promise<void> {
    // migrate room summary isEncrypted -> encryption prop
    const roomSummary = txn.objectStore("roomSummary");
    const roomState = txn.objectStore("roomState");
    const summaries: any[] = [];
    await iterateCursor<any>(roomSummary.openCursor(), summary => {
        summaries.push(summary);
        return NOT_DONE;
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
function createAccountDataStore(db: IDBDatabase): void {
    db.createObjectStore("accountData", {keyPath: "type"});
}

// v7
function createInviteStore(db: IDBDatabase): void {
    db.createObjectStore("invites", {keyPath: "roomId"});
}

// v8
function createArchivedRoomSummaryStore(db: IDBDatabase): void {
    db.createObjectStore("archivedRoomSummary", {keyPath: "summary.roomId"});
}

// v9
async function migrateOperationScopeIndex(db: IDBDatabase, txn: IDBTransaction): Promise<void> {
    try {
        const operations = txn.objectStore("operations");
        operations.deleteIndex("byTypeAndScope");
        await iterateCursor<any>(operations.openCursor(), (op, key, cur) => {
            const {typeScopeKey} = op;
            delete op.typeScopeKey;
            const [type, scope] = typeScopeKey.split("|");
            op.scopeTypeKey = encodeScopeTypeKey(scope, type);
            cur.update(op);
            return NOT_DONE;
        });
        operations.createIndex("byScopeAndType", "scopeTypeKey", {unique: false});
    } catch (err) {
        txn.abort();
        console.error("could not migrate operations", err.stack);
    }
}

//v10
function createTimelineRelationsStore(db: IDBDatabase) : void {
    db.createObjectStore("timelineRelations", {keyPath: "key"});
}

//v11 doesn't change the schema, but ensures all userIdentities have all the roomIds they should (see #470)
async function fixMissingRoomsInUserIdentities(db, txn, log) {
    const roomSummaryStore = txn.objectStore("roomSummary");
    const trackedRoomIds: string[] = [];
    await iterateCursor<SummaryData>(roomSummaryStore.openCursor(), roomSummary => {
        if (roomSummary.isTrackingMembers) {
            trackedRoomIds.push(roomSummary.roomId);
        }
        return NOT_DONE;
    });
    const outboundGroupSessionsStore = txn.objectStore("outboundGroupSessions");
    const userIdentitiesStore: IDBObjectStore = txn.objectStore("userIdentities");
    const roomMemberStore = txn.objectStore("roomMembers");
    for (const roomId of trackedRoomIds) {
        let foundMissing = false;
        const joinedUserIds: string[] = [];
        const memberRange = IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
        await log.wrap({l: "room", id: roomId}, async log => {
            await iterateCursor<MemberData>(roomMemberStore.openCursor(memberRange), member => {
                if (member.membership === "join") {
                    joinedUserIds.push(member.userId);
                }
                return NOT_DONE;
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
