import Room from "./room/room.js";
import { ObservableMap } from "../observable/index.js";
import { SendScheduler, RateLimitingBackoff } from "./SendScheduler.js";
import User from "./User.js";

export default class Session {
    // sessionInfo contains deviceId, userId and homeServer
    constructor({storage, hsApi, sessionInfo}) {
        this._storage = storage;
        this._hsApi = hsApi;
        this._session = null;
        this._sessionInfo = sessionInfo;
        this._rooms = new ObservableMap();
        this._sendScheduler = new SendScheduler({hsApi, backoff: new RateLimitingBackoff()});
        this._roomUpdateCallback = (room, params) => this._rooms.update(room.id, params);
        this._user = new User(sessionInfo.userId);
    }

    async load() {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.session,
            this._storage.storeNames.roomSummary,
            this._storage.storeNames.roomState,
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
            this._storage.storeNames.pendingEvents,
        ]);
        // restore session object
        this._session = await txn.session.get();
        if (!this._session) {
            this._session = {};
            return;
        }
        const pendingEventsByRoomId = await this._getPendingEventsByRoom(txn);
        // load rooms
        const rooms = await txn.roomSummary.getAll();
        await Promise.all(rooms.map(summary => {
            const room = this.createRoom(summary.roomId);
            return room.load(summary, pendingEventsByRoomId.get(summary.roomId), txn);
        }));
    }

    notifyNetworkAvailable() {
        for (const [, room] of this._rooms) {
            room.resumeSending();
        }
    }

    async _getPendingEventsByRoom(txn) {
        const pendingEvents = await txn.pendingEvents.getAll();
        return pendingEvents.reduce((groups, pe) => {
            const group = groups.get(pe.roomId);
            if (group) {
                group.push(pe);
            } else {
                groups.set(pe.roomId, [pe]);
            }
            return groups;
        }, new Map());
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
            sendScheduler: this._sendScheduler,
            user: this._user,
        });
        this._rooms.add(roomId, room);
        return room;
    }

    writeSync(syncToken, syncFilterId, accountData, txn) {
        if (syncToken !== this._session.syncToken) {
            // don't modify this._session because transaction might still fail
            const newSessionData = Object.assign({}, this._session, {syncToken, syncFilterId});
            txn.session.set(newSessionData);
            return newSessionData;
        }
    }

    afterSync(newSessionData) {
        if (newSessionData) {
            // sync transaction succeeded, modify object state now
            this._session = newSessionData;
        }
    }

    get syncToken() {
        return this._session.syncToken;
    }

    get syncFilterId() {
        return this._session.syncFilterId;
    }

    get user() {
        return this._user;
    }
}

export function tests() {
    function createStorageMock(session, pendingEvents = []) {
        return {
            readTxn() {
                return Promise.resolve({
                    session: {
                        get() {
                            return Promise.resolve(Object.assign({}, session));
                        }
                    },
                    pendingEvents: {
                        getAll() {
                            return Promise.resolve(pendingEvents);
                        }
                    },
                    roomSummary: {
                        getAll() {
                            return Promise.resolve([]);
                        }
                    }
                });
            },
            storeNames: {}
        };
    }

    return {
        "session data is not modified until after sync": async (assert) => {
            const session = new Session({storage: createStorageMock({
                syncToken: "a",
                syncFilterId: 5,
            }), sessionInfo: {userId: ""}});
            await session.load();
            let txnSetCalled = false;
            const syncTxn = {
                session: {
                    set({syncToken, syncFilterId}) {
                        txnSetCalled = true;
                        assert.equal(syncToken, "b");
                        assert.equal(syncFilterId, 6);
                    }
                }
            };
            const newSessionData = session.writeSync("b", 6, {}, syncTxn);
            assert(txnSetCalled);
            assert.equal(session.syncToken, "a");
            assert.equal(session.syncFilterId, 5);
            session.afterSync(newSessionData);
            assert.equal(session.syncToken, "b");
            assert.equal(session.syncFilterId, 6);
        }
    }
}
