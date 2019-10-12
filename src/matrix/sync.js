import {RequestAbortError} from "./error.js";
import EventEmitter from "../EventEmitter.js";

const INCREMENTAL_TIMEOUT = 30000;
const SYNC_EVENT_LIMIT = 10;

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

export default class Sync extends EventEmitter {
    constructor({hsApi, session, storage}) {
        super();
        this._hsApi = hsApi;
        this._session = session;
        this._storage = storage;
        this._isSyncing = false;
        this._currentRequest = null;
    }

    get isSyncing() {
        return this._isSyncing;
    }

    // returns when initial sync is done
    async start() {
        if (this._isSyncing) {
            return;
        }
        this._isSyncing = true;
        this.emit("status", "started");
        let syncToken = this._session.syncToken;
        // do initial sync if needed
        if (!syncToken) {
            // need to create limit filter here
            syncToken = await this._syncRequest();
        }
        this._syncLoop(syncToken);
    }

    async _syncLoop(syncToken) {
        // if syncToken is falsy, it will first do an initial sync ... 
        while(this._isSyncing) {
            try {
                console.log(`starting sync request with since ${syncToken} ...`);
                syncToken = await this._syncRequest(syncToken, INCREMENTAL_TIMEOUT);
            } catch (err) {
                this._isSyncing = false;
                if (!(err instanceof RequestAbortError)) {
                    console.error("stopping sync because of error", err.stack);
                    this.emit("status", "error", err);
                }
            }
        }
        this.emit("status", "stopped");
    }

    async _syncRequest(syncToken, timeout) {
        let {syncFilterId} = this._session;
        if (typeof syncFilterId !== "string") {
            syncFilterId = (await this._hsApi.createFilter(this._session.user.id, {room: {state: {lazy_load_members: true}}}).response()).filter_id;
        }
        this._currentRequest = this._hsApi.sync(syncToken, syncFilterId, timeout);
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
        try {
            this._session.persistSync(syncToken, syncFilterId, response.account_data,  syncTxn);
            // to_device
            // presence
            if (response.rooms) {
                const promises = parseRooms(response.rooms, async (roomId, roomResponse, membership) => {
                    let room = this._session.rooms.get(roomId);
                    if (!room) {
                        room = this._session.createRoom(roomId);
                    }
                    console.log(` * applying sync response to room ${roomId} ...`);
                    const changes = await room.persistSync(roomResponse, membership, syncTxn);
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
            console.error("unable to commit sync tranaction", err.message);
            throw err;
        }
        // emit room related events after txn has been closed
        for(let {room, changes} of roomChanges) {
            room.emitSync(changes);
        }

        return syncToken;
    }

    stop() {
        if (!this._isSyncing) {
            return;
        }
        this._isSyncing = false;
        if (this._currentRequest) {
            this._currentRequest.abort();
            this._currentRequest = null;
        }
    }
}
