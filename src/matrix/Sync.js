/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {AbortError} from "./error.js";
import {ObservableValue} from "../observable/ObservableValue.js";
import {createEnum} from "../utils/enum.js";

const INCREMENTAL_TIMEOUT = 30000;
const SYNC_EVENT_LIMIT = 10;

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
 * const preparation = await room.prepareSync(roomResponse, membership, prepareTxn);
 * // can do async work that is not related to storage (such as decryption)
 * await room.afterPrepareSync(preparation);
 * // writes and calculates changes
 * const changes = await room.writeSync(roomResponse, isInitialSync, preparation, syncTxn);
 * // applies and emits changes once syncTxn is committed
 * room.afterSync(changes);
 * if (room.needsAfterSyncCompleted(changes)) {
 *     // can do network requests
 *     await room.afterSyncCompleted(changes);
 * }
 * ```
 */
export class Sync {
    constructor({hsApi, session, storage}) {
        this._hsApi = hsApi;
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
            try {
                console.log(`starting sync request with since ${syncToken} ...`);
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
                const syncResult = await this._syncRequest(syncToken, timeout);
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
                    continue;
                }
                if (err.name !== AbortError) {
                    console.warn("stopping sync because of error");
                    console.error(err);
                    this._error = err;
                }
                this._status.set(SyncStatus.Stopped);
            }
            if (this._status.get() !== SyncStatus.Stopped) {
                // TODO: if we're not going to run this phase in parallel with the next
                // sync request (because this causes OTKs to be uploaded twice)
                // should we move this inside _syncRequest?
                // Alternatively, we can try to fix the OTK upload issue while still
                // running in parallel. 
                await this._runAfterSyncCompleted(sessionChanges, roomStates);
            }
        }
    }

    async _runAfterSyncCompleted(sessionChanges, roomStates) {
        const isCatchupSync = this._status.get() === SyncStatus.CatchupSync;
        const sessionPromise = (async () => {
            try {
                await this._session.afterSyncCompleted(sessionChanges, isCatchupSync);
            } catch (err) {
                console.error("error during session afterSyncCompleted, continuing",  err.stack);
            }
        })();

        const roomsNeedingAfterSyncCompleted = roomStates.filter(rs => {
            return rs.room.needsAfterSyncCompleted(rs.changes);
        });
        const roomsPromises = roomsNeedingAfterSyncCompleted.map(async rs => {
            try {
                await rs.room.afterSyncCompleted(rs.changes);
            } catch (err) {
                console.error(`error during room ${rs.room.id} afterSyncCompleted, continuing`,  err.stack);
            }
        });
        // run everything in parallel,
        // we don't want to delay the next sync too much
        // Also, since all promises won't reject (as they have a try/catch)
        // it's fine to use Promise.all
        await Promise.all(roomsPromises.concat(sessionPromise));
    }

    async _syncRequest(syncToken, timeout) {
        let {syncFilterId} = this._session;
        if (typeof syncFilterId !== "string") {
            this._currentRequest = this._hsApi.createFilter(this._session.user.id, {room: {state: {lazy_load_members: true}}});
            syncFilterId = (await this._currentRequest.response()).filter_id;
        }
        const totalRequestTimeout = timeout + (80 * 1000);  // same as riot-web, don't get stuck on wedged long requests
        this._currentRequest = this._hsApi.sync(syncToken, syncFilterId, timeout, {timeout: totalRequestTimeout});
        const response = await this._currentRequest.response();

        const isInitialSync = !syncToken;
        syncToken = response.next_batch;
        const roomStates = this._parseRoomsResponse(response.rooms, isInitialSync);
        await this._prepareRooms(roomStates);
        let sessionChanges;
        const syncTxn = this._openSyncTxn();
        try {
            await Promise.all(roomStates.map(async rs => {
                console.log(` * applying sync response to room ${rs.room.id} ...`);
                rs.changes = await rs.room.writeSync(
                    rs.roomResponse, isInitialSync, rs.preparation, syncTxn);
            }));
            sessionChanges = await this._session.writeSync(response, syncFilterId, syncTxn);
        } catch(err) {
            // avoid corrupting state by only
            // storing the sync up till the point
            // the exception occurred
            try {
                syncTxn.abort();
            } catch (abortErr) { /* ignore when we can't abort */ } 
            throw err;
        }
        try {
            await syncTxn.complete();
            console.info("syncTxn committed!!");
        } catch (err) {
            console.error("unable to commit sync tranaction");
            throw err;
        }
        this._session.afterSync(sessionChanges);
        // emit room related events after txn has been closed
        for(let rs of roomStates) {
            rs.room.afterSync(rs.changes);
        }

        const toDeviceEvents = response.to_device?.events;
        return {
            syncToken,
            roomStates,
            sessionChanges,
            hadToDeviceMessages: Array.isArray(toDeviceEvents) && toDeviceEvents.length > 0,
        };
    }

    _openPrepareSyncTxn() {
        const storeNames = this._storage.storeNames;
        return this._storage.readTxn([
            storeNames.inboundGroupSessions,
        ]);
    }

    async _prepareRooms(roomStates) {
        const prepareTxn = this._openPrepareSyncTxn();
        await Promise.all(roomStates.map(async rs => {
            rs.preparation = await rs.room.prepareSync(rs.roomResponse, rs.membership, prepareTxn);
        }));
        await Promise.all(roomStates.map(rs => rs.room.afterPrepareSync(rs.preparation)));
    }

    _openSyncTxn() {
        const storeNames = this._storage.storeNames;
        return this._storage.readWriteTxn([
            storeNames.session,
            storeNames.roomSummary,
            storeNames.roomState,
            storeNames.roomMembers,
            storeNames.timelineEvents,
            storeNames.timelineFragments,
            storeNames.pendingEvents,
            storeNames.userIdentities,
            storeNames.groupSessionDecryptions,
            storeNames.deviceIdentities,
            // to discard outbound session when somebody leaves a room
            // and to create room key messages when somebody leaves
            storeNames.outboundGroupSessions,
            storeNames.operations,
            storeNames.accountData,
        ]);
    }
    
    _parseRoomsResponse(roomsSection, isInitialSync) {
        const roomStates = [];
        if (roomsSection) {
            // don't do "invite", "leave" for now
            const allMemberships = ["join"];
            for(const membership of allMemberships) {
                const membershipSection = roomsSection[membership];
                if (membershipSection) {
                    for (const [roomId, roomResponse] of Object.entries(membershipSection)) {
                        // ignore rooms with empty timelines during initial sync,
                        // see https://github.com/vector-im/hydrogen-web/issues/15
                        if (isInitialSync && timelineIsEmpty(roomResponse)) {
                            continue;
                        }
                        let room = this._session.rooms.get(roomId);
                        if (!room) {
                            room = this._session.createRoom(roomId);
                        }
                        roomStates.push(new RoomSyncProcessState(room, roomResponse, membership));
                    }
                }
            }
        }
        return roomStates;
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

class RoomSyncProcessState {
    constructor(room, roomResponse, membership) {
        this.room = room;
        this.roomResponse = roomResponse;
        this.membership = membership;
        this.preparation = null;
        this.changes = null;
    }
}
