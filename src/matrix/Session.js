/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {Room} from "./room/Room.js";
import { ObservableMap } from "../observable/index.js";
import { SendScheduler, RateLimitingBackoff } from "./SendScheduler.js";
import {User} from "./User.js";

export class Session {
    // sessionInfo contains deviceId, userId and homeServer
    constructor({storage, hsApi, sessionInfo}) {
        this._storage = storage;
        this._hsApi = hsApi;
        this._syncToken = null;
        this._syncFilterId = null;
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
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
            this._storage.storeNames.pendingEvents,
        ]);
        // restore session object
        const [syncToken, syncFilterId] = await Promise.all([
            txn.session.get("syncToken"),
            txn.session.get("syncFilterId")
        ]);
        this._syncToken = syncToken;
        this._syncFilterId = syncFilterId;
        const pendingEventsByRoomId = await this._getPendingEventsByRoom(txn);
        // load rooms
        const rooms = await txn.roomSummary.getAll();
        await Promise.all(rooms.map(summary => {
            const room = this.createRoom(summary.roomId, pendingEventsByRoomId.get(summary.roomId));
            return room.load(summary, txn);
        }));
    }

    get isStarted() {
        return this._sendScheduler.isStarted;
    }

    stop() {
        this._sendScheduler.stop();
    }

    async start(lastVersionResponse) {
        if (lastVersionResponse) {
            // store /versions response
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.session
            ]);
            txn.session.set("serverVersions", lastVersionResponse);
            // TODO: what can we do if this throws?
            await txn.complete();
        }

        this._sendScheduler.start();
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

    createRoom(roomId, pendingEvents) {
        const room = new Room({
            roomId,
            storage: this._storage,
            emitCollectionChange: this._roomUpdateCallback,
            hsApi: this._hsApi,
            sendScheduler: this._sendScheduler,
            pendingEvents,
            user: this._user,
        });
        this._rooms.add(roomId, room);
        return room;
    }

    writeSync(syncToken, syncFilterId, accountData, txn) {
        if (syncToken !== this._syncToken) {
            // don't modify `this` because transaction might still fail
            txn.session.set("syncToken", syncToken);
            txn.session.set("syncFilterId", syncFilterId);
            return {syncToken, syncFilterId};
        }
    }

    afterSync(changes) {
        if (changes) {
            // sync transaction succeeded, modify object state now
            this._syncToken = changes.syncToken;
            this._syncFilterId = changes.syncFilterId;
        }
    }

    get syncToken() {
        return this._syncToken;
    }

    get syncFilterId() {
        return this._syncFilterId;
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
                        get(key) {
                            return Promise.resolve(session[key]);
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
            let syncTokenSet = false;
            let syncFilterIdSet = false;
            const syncTxn = {
                session: {
                    set(key, value) {
                        if (key === "syncToken") {
                            assert.equal(value, "b");
                            syncTokenSet = true;
                        } else if (key === "syncFilterId") {
                            assert.equal(value, 6);
                            syncFilterIdSet = true;
                        }
                    }
                }
            };
            const newSessionData = session.writeSync("b", 6, {}, syncTxn);
            assert(syncTokenSet);
            assert(syncFilterIdSet);
            assert.equal(session.syncToken, "a");
            assert.equal(session.syncFilterId, 5);
            session.afterSync(newSessionData);
            assert.equal(session.syncToken, "b");
            assert.equal(session.syncFilterId, 6);
        }
    }
}
