import {IDOMStorage} from "./types";
import {ITransaction} from "./QueryTarget";
import {iterateCursor, NOT_DONE, reqAsPromise} from "./utils";
import {RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../room/members/RoomMember.js";
import {SESSION_E2EE_KEY_PREFIX} from "../../e2ee/common.js";
import {SummaryData} from "../../room/RoomSummary";
import {RoomMemberStore, MemberData} from "./stores/RoomMemberStore";
import {InboundGroupSessionStore, InboundGroupSessionEntry, BackupStatus, KeySource} from "./stores/InboundGroupSessionStore";
import {RoomStateEntry} from "./stores/RoomStateStore";
import {SessionStore} from "./stores/SessionStore";
import {Store} from "./Store";
import {encodeScopeTypeKey} from "./stores/OperationStore";
import {MAX_UNICODE} from "./stores/common";
import {ILogItem} from "../../../logging/types";


export type MigrationFunc = (db: IDBDatabase, txn: IDBTransaction, localStorage: IDOMStorage, log: ILogItem) => Promise<void> | void;
// FUNCTIONS SHOULD ONLY BE APPENDED!!
// the index in the array is the database version
export const schema: MigrationFunc[] = [
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
    fixMissingRoomsInUserIdentities,
    changeSSSSKeyPrefix,
    backupAndRestoreE2EEAccountToLocalStorage,
    clearAllStores,
    addInboundSessionBackupIndex,
    migrateBackupStatus
];
// TODO: how to deal with git merge conflicts of this array?

// TypeScript note: for now, do not bother introducing interfaces / alias
// for old schemas. Just take them as `any`. 

function createDatabaseNameHelper(db: IDBDatabase): ITransaction {
    // the Store object gets passed in several things through the Transaction class (a wrapper around IDBTransaction),
    // the only thing we should need here is the databaseName though, so we mock it out.
    // ideally we should have an easier way to go from the idb primitive layer to the specific store classes where
    // we implement logic, but for now we need this.
    const databaseNameHelper: ITransaction = {
        databaseName: db.name,
        get idbFactory(): IDBFactory { throw new Error("unused");},
        get IDBKeyRange(): typeof IDBKeyRange { throw new Error("unused");},
        addWriteError() {},
    };
    return databaseNameHelper;
}


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
async function migrateSession(db: IDBDatabase, txn: IDBTransaction, localStorage: IDOMStorage): Promise<void> {
    const session = txn.objectStore("session");
    try {
        const PRE_MIGRATION_KEY = 1;
        const entry = await reqAsPromise(session.get(PRE_MIGRATION_KEY));
        if (entry) {
            session.delete(PRE_MIGRATION_KEY);
            const {syncToken, syncFilterId, serverVersions} = entry.value;
            // Cast ok here because only "set" is used and we don't look into return
            const store = new SessionStore(session as any, localStorage);
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

//v11 doesn't change the schema,
// but ensured all userIdentities have all the roomIds they should (see #470)

// 2022-07-20: The fix dated from August 2021, and have removed it now because of a
// refactoring needed in the device tracker, which made it inconvenient to expose addRoomToIdentity
function fixMissingRoomsInUserIdentities() {}

// v12 move ssssKey to e2ee:ssssKey so it will get backed up in the next step
async function changeSSSSKeyPrefix(db: IDBDatabase, txn: IDBTransaction) {
    const session = txn.objectStore("session");
    const ssssKey = await reqAsPromise(session.get("ssssKey"));
    if (ssssKey) {
        session.put({key: `${SESSION_E2EE_KEY_PREFIX}ssssKey`, value: ssssKey.value});
    }
}
// v13
async function backupAndRestoreE2EEAccountToLocalStorage(db: IDBDatabase, txn: IDBTransaction, localStorage: IDOMStorage, log: ILogItem) {
    const session = txn.objectStore("session");
    const sessionStore = new SessionStore(new Store(session, createDatabaseNameHelper(db)), localStorage);
    // if we already have an e2ee identity, write a backup to local storage.
    // further updates to e2ee keys in the session store will also write to local storage from 0.2.15 on,
    // but here we make sure a backup is immediately created after installing the update and we don't wait until
    // the olm account needs to change
    sessionStore.writeE2EEIdentityToLocalStorage();
    // and if we already have a backup, restore it now for any missing key in idb.
    // this will restore the backup every time the idb database is dropped as it will
    // run through all the migration steps when recreating it.
    const restored = await sessionStore.tryRestoreE2EEIdentityFromLocalStorage(log);
    log.set("restored", restored);
}
// v14 clear all stores apart from e2ee keys because of possible timeline corruption in #515, will trigger initial sync
async function clearAllStores(db: IDBDatabase, txn: IDBTransaction) {
    for (const storeName of db.objectStoreNames) {
        const store = txn.objectStore(storeName);
        switch (storeName) {
            case "inboundGroupSessions":
            case "outboundGroupSessions":
            case "olmSessions":
            case "operations":
                continue;
            case "session": {
                await iterateCursor(store.openCursor(), (value, key, cursor) => {
                    if (!(key as string).startsWith(SESSION_E2EE_KEY_PREFIX)) {
                        cursor.delete();
                    }
                    return NOT_DONE;
                })
                break;
            }
            default: {
                store.clear();
                break;
            }
        }
    }
}

// v15 add backup index to inboundGroupSessions
async function addInboundSessionBackupIndex(db: IDBDatabase, txn: IDBTransaction, localStorage: IDOMStorage, log: ILogItem): Promise<void> {
    const inboundGroupSessions = txn.objectStore("inboundGroupSessions");
    inboundGroupSessions.createIndex("byBackup", "backup", {unique: false});
}


// v16 migrates the backup and source fields of inbound group sessions
async function migrateBackupStatus(db: IDBDatabase, txn: IDBTransaction, localStorage: IDOMStorage, log: ILogItem): Promise<void> {
    const inboundGroupSessions = txn.objectStore("inboundGroupSessions");
    let countWithSession = 0;
    let countWithoutSession = 0;
    await iterateCursor<InboundGroupSessionEntry>(inboundGroupSessions.openCursor(), (value, key, cursor) => {
        if (value.session) {
            value.backup = BackupStatus.NotBackedUp;
            // we'll also have backup keys in here, we can't tell,
            // but the worst thing that can happen is that we try
            // to backup keys that were already in backup, which
            // the server will ignore
            value.source = KeySource.DeviceMessage;
            cursor.update(value);
            countWithSession += 1;
        } else {
            countWithoutSession += 1;
        }
        return NOT_DONE;
    });
    log.set("countWithoutSession", countWithoutSession);
    log.set("countWithSession", countWithSession);
}
