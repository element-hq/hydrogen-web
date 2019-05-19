import Room from "./room/room.js";
import { ObservableMap } from "../observable/index.js";

export default class Session {
    // sessionInfo contains deviceId, userId and homeServer
    constructor({storage, hsApi, sessionInfo}) {
        this._storage = storage;
        this._hsApi = hsApi;
        this._session = null;
        this._sessionInfo = sessionInfo;
        this._rooms = new ObservableMap();
        this._roomUpdateCallback = (room, params) => this._rooms.update(room.id, params);
    }

    async load() {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.session,
            this._storage.storeNames.roomSummary,
            this._storage.storeNames.roomState,
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ]);
        // restore session object
        this._session = await txn.session.get();
        if (!this._session) {
            this._session = {};
            return;
        }
        // load rooms
        const rooms = await txn.roomSummary.getAll();
        await Promise.all(rooms.map(summary => {
            const room = this.createRoom(summary.roomId);
            return room.load(summary, txn);
        }));
    }

    get rooms() {
        return this._rooms;
    }

    createRoom(roomId) {
        const room = new Room({
            roomId,
            storage: this._storage,
            emitCollectionChange: this._roomUpdateCallback,
            hsApi: this._hsApi,
        });
        this._rooms.add(roomId, room);
        return room;
    }

    persistSync(syncToken, accountData, txn) {
        if (syncToken !== this._session.syncToken) {
            this._session.syncToken = syncToken;
            txn.session.set(this._session);
        }
    }

    get syncToken() {
        return this._session.syncToken;
    }
}
