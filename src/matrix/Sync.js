/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {ObservableValue} from "../observable/ObservableValue";
import {createEnum} from "../utils/enum";

const INCREMENTAL_TIMEOUT = 30000;

export const SyncStatus = createEnum(
    "InitialSync",
    "CatchupSync",
    "Syncing",
    "Stopped"
);

function timelineIsEmpty(roomResponse) {
    try {
        const events = roomResponse?.timeline?.events;
        return Array.isArray(events) && events.length === 0;
    } catch (err) {
        return true;
    }
}

/**
 * Sync steps in js-pseudocode:
 * ```js
 * // can only read some stores
 * const preparation = await room.prepareSync(roomResponse, membership, newRoomKeys, prepareTxn);
 * // can do async work that is not related to storage (such as decryption)
 * await room.afterPrepareSync(preparation);
 * // writes and calculates changes
 * const changes = await room.writeSync(roomResponse, isInitialSync, preparation, syncTxn);
 * // applies and emits changes once syncTxn is committed
 * room.afterSync(changes);
 * // can do network requests
 * await room.afterSyncCompleted(changes);
 * ```
 */
export class Sync {
    constructor({hsApi, session, storage, logger}) {
        this._hsApi = hsApi;
        this._logger = logger;
        this._session = session;
        this._storage = storage;
        this._currentRequest = null;
        this._status = new ObservableValue(SyncStatus.Stopped);
        this._error = null;
    }

    get status() {
        return this._status;
    }

    /** the error that made the sync stop */
    get error() {
        return this._error;
    }

    start() {
        // not already syncing?
        if (this._status.get() !== SyncStatus.Stopped) {
            return;
        }
        this._error = null;
        let syncToken = this._session.syncToken;
        if (syncToken) {
            this._status.set(SyncStatus.CatchupSync);
        } else {
            this._status.set(SyncStatus.InitialSync);
        }
        this._syncLoop(syncToken);
    }

    async _syncLoop(syncToken) {
        // if syncToken is falsy, it will first do an initial sync ... 
        while(this._status.get() !== SyncStatus.Stopped) {
            let roomStates;
            let sessionChanges;
            let wasCatchupOrInitial = this._status.get() === SyncStatus.CatchupSync || this._status.get() === SyncStatus.InitialSync;
            await this._logger.run("sync", async log => {
                log.set("token", syncToken);
                log.set("status", this._status.get());
                try {
                    // unless we are happily syncing already, we want the server to return
                    // as quickly as possible, even if there are no events queued. This
                    // serves two purposes:
                    //
                    // * When the connection dies, we want to know asap when it comes back,
                    //   so that we can hide the error from the user. (We don't want to
                    //   have to wait for an event or a timeout).
                    //
                    // * We want to know if the server has any to_device messages queued up
                    //   for us. We do that by calling it with a zero timeout until it
                    //   doesn't give us any more to_device messages.
                    const timeout = this._status.get() === SyncStatus.Syncing ? INCREMENTAL_TIMEOUT : 0; 
                    const syncResult = await this._syncRequest(syncToken, timeout, log);
                    syncToken = syncResult.syncToken;
                    roomStates = syncResult.roomStates;
                    sessionChanges = syncResult.sessionChanges;
                    // initial sync or catchup sync
                    if (this._status.get() !== SyncStatus.Syncing && syncResult.hadToDeviceMessages) {
                        this._status.set(SyncStatus.CatchupSync);
                    } else {
                        this._status.set(SyncStatus.Syncing);
                    }
                } catch (err) {
                    // retry same request on timeout
                    if (err.name === "ConnectionError" && err.isTimeout) {
                        // don't run afterSyncCompleted
                        return;
                    }
                    this._error = err;
                    if (err.name !== "AbortError") {
                        // sync wasn't asked to stop, but is stopping
                        // because of the error.
                        log.error = err;
                        log.logLevel = log.level.Fatal;
                    }
                    log.set("stopping", true);
                    this._status.set(SyncStatus.Stopped);
                }
                if (this._status.get() !== SyncStatus.Stopped) {
                    // TODO: if we're not going to run this phase in parallel with the next
                    // sync request (because this causes OTKs to be uploaded twice)
                    // should we move this inside _syncRequest?
                    // Alternatively, we can try to fix the OTK upload issue while still
                    // running in parallel.
                    await log.wrap("afterSyncCompleted", log => this._runAfterSyncCompleted(sessionChanges, roomStates, log));
                }
            },
            this._logger.level.Info,
            (filter, log) => {
                if (log.durationWithoutType("network") >= 2000 || log.error || wasCatchupOrInitial) {
                    return filter.minLevel(log.level.Detail);
                } else {
                    return filter.minLevel(log.level.Info);
                }
            });
        }
    }

    async _runAfterSyncCompleted(sessionChanges, roomStates, log) {
        const isCatchupSync = this._status.get() === SyncStatus.CatchupSync;
        const sessionPromise = (async () => {
            try {
                await log.wrap("session", log => this._session.afterSyncCompleted(sessionChanges, isCatchupSync, log));
            } catch (err) {} // error is logged, but don't fail sessionPromise
        })();
        const roomsPromises = roomStates.map(async rs => {
            try {
                await rs.room.afterSyncCompleted(rs.changes, log);
            } catch (err) {} // error is logged, but don't fail roomsPromises
        });
        // run everything in parallel,
        // we don't want to delay the next sync too much
        // Also, since all promises won't reject (as they have a try/catch)
        // it's fine to use Promise.all
        await Promise.all(roomsPromises.concat(sessionPromise));
    }

    async _syncRequest(syncToken, timeout, log) {
        let {syncFilterId} = this._session;
        if (typeof syncFilterId !== "string") {
            this._currentRequest = this._hsApi.createFilter(this._session.user.id, {room: {state: {lazy_load_members: true}}}, {log});
            syncFilterId = (await this._currentRequest.response()).filter_id;
        }
        const totalRequestTimeout = timeout + (80 * 1000);  // same as riot-web, don't get stuck on wedged long requests
        this._currentRequest = this._hsApi.sync(syncToken, syncFilterId, timeout, {timeout: totalRequestTimeout, log});
        const response = await this._currentRequest.response();

        const isInitialSync = !syncToken;
        const sessionState = new SessionSyncProcessState();
        const inviteStates = this._parseInvites(response.rooms);
        const {roomStates, archivedRoomStates} = await this._parseRoomsResponse(
            response.rooms, inviteStates, isInitialSync, log);

        try {
            // take a lock on olm sessions used in this sync so sending a message doesn't change them while syncing
            sessionState.lock = await log.wrap("obtainSyncLock", () => this._session.obtainSyncLock(response));
            await log.wrap("prepare", log => this._prepareSync(sessionState, roomStates, response, log));
            await log.wrap("afterPrepareSync", log => Promise.all(roomStates.map(rs => {
                return rs.room.afterPrepareSync(rs.preparation, log);
            })));
            await log.wrap("write", async log => this._writeSync(
                sessionState, inviteStates, roomStates, archivedRoomStates,
                response, syncFilterId, isInitialSync, log));
        } finally {
            sessionState.dispose();
        }
        // sync txn comitted, emit updates and apply changes to in-memory state
        log.wrap("after", log => this._afterSync(
            sessionState, inviteStates, roomStates, archivedRoomStates, log));

        const toDeviceEvents = response.to_device?.events;
        return {
            syncToken: response.next_batch,
            roomStates,
            sessionChanges: sessionState.changes,
            hadToDeviceMessages: Array.isArray(toDeviceEvents) && toDeviceEvents.length > 0,
        };
    }

    _openPrepareSyncTxn() {
        const storeNames = this._storage.storeNames;
        return this._storage.readTxn([
            storeNames.olmSessions,
            storeNames.inboundGroupSessions,
            // to read fragments when loading sync writer when rejoining archived room
            storeNames.timelineFragments,
            // to read fragments when loading sync writer when rejoining archived room
            // to read events that can now be decrypted
            storeNames.timelineEvents,
        ]);
    }

    async _prepareSync(sessionState, roomStates, response, log) {
        const prepareTxn = await this._openPrepareSyncTxn();
        sessionState.preparation = await log.wrap("session", log => this._session.prepareSync(
            response, sessionState.lock, prepareTxn, log));

        const newKeysByRoom = sessionState.preparation?.newKeysByRoom;

        // add any rooms with new keys but no sync response to the list of rooms to be synced
        if (newKeysByRoom) {
            const {hasOwnProperty} = Object.prototype;
            for (const roomId of newKeysByRoom.keys()) {
                const isRoomInResponse = response.rooms?.join && hasOwnProperty.call(response.rooms.join, roomId);
                if (!isRoomInResponse) {
                    let room = this._session.rooms.get(roomId);
                    if (room) {
                        roomStates.push(new RoomSyncProcessState(room, false, {}, room.membership));
                    }
                }
            }
        }
        
        await Promise.all(roomStates.map(async rs => {
            const newKeys = newKeysByRoom?.get(rs.room.id);
            rs.preparation = await log.wrap("room", async log => {
                // if previously joined and we still have the timeline for it,
                // this loads the syncWriter at the correct position to continue writing the timeline
                if (rs.isNewRoom) {
                    await rs.room.load(null, prepareTxn, log);
                }
                return rs.room.prepareSync(
                    rs.roomResponse, rs.membership, newKeys, prepareTxn, log)
            }, log.level.Detail);
        }));

        // This is needed for safari to not throw TransactionInactiveErrors on the syncTxn. See docs/INDEXEDDB.md
        await prepareTxn.complete();
    }

    async _writeSync(sessionState, inviteStates, roomStates, archivedRoomStates, response, syncFilterId, isInitialSync, log) {
        const syncTxn = await this._openSyncTxn();
        try {
            sessionState.changes = await log.wrap("session", log => this._session.writeSync(
                response, syncFilterId, sessionState.preparation, syncTxn, log));
            await Promise.all(inviteStates.map(async is => {
                is.changes = await log.wrap("invite", log => is.invite.writeSync(
                    is.membership, is.roomResponse, syncTxn, log));
            }));
            await Promise.all(roomStates.map(async rs => {
                rs.changes = await log.wrap("room", log => rs.room.writeSync(
                    rs.roomResponse, isInitialSync, rs.preparation, syncTxn, log));
            }));
            // important to do this after roomStates,
            // as we're referring to the roomState to get the summaryChanges
            await Promise.all(archivedRoomStates.map(async ars => {
                const summaryChanges = ars.roomState?.summaryChanges;
                ars.changes = await log.wrap("archivedRoom", log => ars.archivedRoom.writeSync(
                    summaryChanges, ars.roomResponse, ars.membership, syncTxn, log));
            }));
        } catch(err) {
            // avoid corrupting state by only
            // storing the sync up till the point
            // the exception occurred
            syncTxn.abort(log);
            throw syncTxn.getCause(err);
        }
        await syncTxn.complete(log);
    }

    _afterSync(sessionState, inviteStates, roomStates, archivedRoomStates, log) {
        log.wrap("session", log => this._session.afterSync(sessionState.changes, log), log.level.Detail);
        for(let ars of archivedRoomStates) {
            log.wrap("archivedRoom", log => {
                ars.archivedRoom.afterSync(ars.changes, log);
                ars.archivedRoom.release();
            }, log.level.Detail);
        }
        for(let rs of roomStates) {
            log.wrap("room", log => rs.room.afterSync(rs.changes, log), log.level.Detail);
        }
        for(let is of inviteStates) {
            log.wrap("invite", log => is.invite.afterSync(is.changes, log), log.level.Detail);
        }
        this._session.applyRoomCollectionChangesAfterSync(inviteStates, roomStates, archivedRoomStates, log);
    }

    _openSyncTxn() {
        const storeNames = this._storage.storeNames;
        return this._storage.readWriteTxn([
            storeNames.session,
            storeNames.roomSummary,
            storeNames.archivedRoomSummary,
            storeNames.invites,
            storeNames.roomState,
            storeNames.roomMembers,
            storeNames.timelineEvents,
            storeNames.timelineRelations,
            storeNames.timelineFragments,
            storeNames.pendingEvents,
            storeNames.userIdentities,
            storeNames.groupSessionDecryptions,
            storeNames.deviceIdentities,
            // to discard outbound session when somebody leaves a room
            // and to create room key messages when somebody joins
            storeNames.outboundGroupSessions,
            storeNames.operations,
            storeNames.accountData,
            // to decrypt and store new room keys
            storeNames.olmSessions,
            storeNames.inboundGroupSessions,
        ]);
    }
    
    async _parseRoomsResponse(roomsSection, inviteStates, isInitialSync, log) {
        const roomStates = [];
        const archivedRoomStates = [];
        if (roomsSection) {
            const allMemberships = ["join", "leave"];
            for(const membership of allMemberships) {
                const membershipSection = roomsSection[membership];
                if (membershipSection) {
                    for (const [roomId, roomResponse] of Object.entries(membershipSection)) {
                        // ignore rooms with empty timelines during initial sync,
                        // see https://github.com/vector-im/hydrogen-web/issues/15
                        if (isInitialSync && timelineIsEmpty(roomResponse)) {
                            continue;
                        }
                        const invite = this._session.invites.get(roomId);
                        // if there is an existing invite, add a process state for it
                        // so its writeSync and afterSync will run and remove the invite
                        if (invite) {
                            inviteStates.push(new InviteSyncProcessState(invite, false, null, membership));
                        }
                        const roomState = this._createRoomSyncState(roomId, roomResponse, membership, isInitialSync);
                        if (roomState) {
                            roomStates.push(roomState);
                        }
                        const ars = await this._createArchivedRoomSyncState(roomId, roomState, roomResponse, membership, isInitialSync, log);
                        if (ars) {
                            archivedRoomStates.push(ars);
                        }
                    }
                }
            }
        }
        return {roomStates, archivedRoomStates};
    }

    _createRoomSyncState(roomId, roomResponse, membership, isInitialSync) {
        let isNewRoom = false;
        let room = this._session.rooms.get(roomId);
        // create room only either on new join,
        // or for an archived room during initial sync,
        // where we create the summaryChanges with a joined
        // room to then adopt by the archived room.
        // This way the limited timeline, members, ...
        // we receive also gets written.
        // In any case, don't create a room for a rejected invite
        if (!room && (membership === "join" || (isInitialSync && membership === "leave"))) {
            room = this._session.createJoinedRoom(roomId);
            isNewRoom = true;
        }
        if (room) {
            return new RoomSyncProcessState(
                room, isNewRoom, roomResponse, membership);
        }
    }

    async _createArchivedRoomSyncState(roomId, roomState, roomResponse, membership, isInitialSync, log) {
        let archivedRoom;
        if (roomState?.shouldAdd && !isInitialSync) {
            // when adding a joined room during incremental sync,
            // always create the archived room to write the removal
            // of the archived summary
            archivedRoom = this._session.createOrGetArchivedRoomForSync(roomId);
        } else if (membership === "leave") {
            if (roomState) {
                // we still have a roomState, so we just left it
                // in this case, create a new archivedRoom
                archivedRoom = this._session.createOrGetArchivedRoomForSync(roomId);
            } else {
                // this is an update of an already left room, restore
                // it from storage first, so we can increment it.
                // this happens for example when our membership changes
                // after leaving (e.g. being (un)banned, possibly after being kicked), etc
                archivedRoom = await this._session.loadArchivedRoom(roomId, log);
            }
        }
        if (archivedRoom) {
            return new ArchivedRoomSyncProcessState(
                archivedRoom, roomState, roomResponse, membership);
        }
    }

    _parseInvites(roomsSection) {
        const inviteStates = [];
        if (roomsSection?.invite) {
            for (const [roomId, roomResponse] of Object.entries(roomsSection.invite)) {
                let invite = this._session.invites.get(roomId);
                let isNewInvite = false;
                if (!invite) {
                    invite = this._session.createInvite(roomId);
                    isNewInvite = true;
                }
                inviteStates.push(new InviteSyncProcessState(invite, isNewInvite, roomResponse, "invite"));
            }
        }
        return inviteStates;
    }

    stop() {
        if (this._status.get() === SyncStatus.Stopped) {
            return;
        }
        this._status.set(SyncStatus.Stopped);
        if (this._currentRequest) {
            this._currentRequest.abort();
            this._currentRequest = null;
        }
    }
}

class SessionSyncProcessState {
    constructor() {
        this.lock = null;
        this.preparation = null;
        this.changes = null;
    }

    dispose() {
        this.lock?.release();
    }
}

class RoomSyncProcessState {
    constructor(room, isNewRoom, roomResponse, membership) {
        this.room = room;
        this.isNewRoom = isNewRoom;
        this.roomResponse = roomResponse;
        this.membership = membership;
        this.preparation = null;
        this.changes = null;
    }

    get id() {
        return this.room.id;
    }

    get shouldAdd() {
        return this.isNewRoom && this.membership === "join";
    }

    get shouldRemove() {
        return !this.isNewRoom && this.membership !== "join";
    }

    get summaryChanges() {
        return this.changes?.summaryChanges;
    }
}


class ArchivedRoomSyncProcessState {
    constructor(archivedRoom, roomState, roomResponse, membership, isInitialSync) {
        this.archivedRoom = archivedRoom;
        this.roomState = roomState;
        this.roomResponse = roomResponse;
        this.membership = membership;
        this.isInitialSync = isInitialSync;
        this.changes = null;
    }

    get id() {
        return this.archivedRoom.id;
    }

    get shouldAdd() {
        return (this.roomState || this.isInitialSync) && this.membership === "leave";
    }

    get shouldRemove() {
        return this.membership === "join";
    }
}

class InviteSyncProcessState {
    constructor(invite, isNewInvite, roomResponse, membership) {
        this.invite = invite;
        this.isNewInvite = isNewInvite;
        this.membership = membership;
        this.roomResponse = roomResponse;
        this.changes = null;
    }

    get id() {
        return this.invite.id;
    }

    get shouldAdd() {
        return this.isNewInvite;
    }

    get shouldRemove() {
        return this.membership !== "invite";
    }
}
