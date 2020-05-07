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

function parseRooms(roomsSection, roomCallback) {
    if (roomsSection) {
        const allMemberships = ["join", "invite", "leave"];
        for(const membership of allMemberships) {
            const membershipSection = roomsSection[membership];
            if (membershipSection) {
                return Object.entries(membershipSection).map(([roomId, roomResponse]) => {
                    return roomCallback(roomId, roomResponse, membership);
                });
            }
        }
    }
    return [];
}

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
            try {
                console.log(`starting sync request with since ${syncToken} ...`);
                const timeout = syncToken ? INCREMENTAL_TIMEOUT : undefined; 
                syncToken = await this._syncRequest(syncToken, timeout);
                this._status.set(SyncStatus.Syncing);
            } catch (err) {
                if (!(err instanceof AbortError)) {
                    this._error = err;
                    this._status.set(SyncStatus.Stopped);
                }
            }
        }
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
        syncToken = response.next_batch;
        const storeNames = this._storage.storeNames;
        const syncTxn = await this._storage.readWriteTxn([
            storeNames.session,
            storeNames.roomSummary,
            storeNames.roomState,
            storeNames.timelineEvents,
            storeNames.timelineFragments,
            storeNames.pendingEvents,
        ]);
        const roomChanges = [];
        let sessionChanges;
        try {
            sessionChanges = this._session.writeSync(syncToken, syncFilterId, response.account_data,  syncTxn);
            // to_device
            // presence
            if (response.rooms) {
                const promises = parseRooms(response.rooms, async (roomId, roomResponse, membership) => {
                    let room = this._session.rooms.get(roomId);
                    if (!room) {
                        room = this._session.createRoom(roomId);
                    }
                    console.log(` * applying sync response to room ${roomId} ...`);
                    const changes = await room.writeSync(roomResponse, membership, syncTxn);
                    roomChanges.push({room, changes});
                });
                await Promise.all(promises);
            }
        } catch(err) {
            console.warn("aborting syncTxn because of error");
            // avoid corrupting state by only
            // storing the sync up till the point
            // the exception occurred
            syncTxn.abort();
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
        for(let {room, changes} of roomChanges) {
            room.afterSync(changes);
        }

        return syncToken;
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
