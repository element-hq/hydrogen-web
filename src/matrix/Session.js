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
import {Pusher} from "./push/Pusher.js";
import { ObservableMap } from "../observable/index.js";
import {User} from "./User.js";
import {DeviceMessageHandler} from "./DeviceMessageHandler.js";
import {Account as E2EEAccount} from "./e2ee/Account.js";
import {Decryption as OlmDecryption} from "./e2ee/olm/Decryption.js";
import {Encryption as OlmEncryption} from "./e2ee/olm/Encryption.js";
import {Decryption as MegOlmDecryption} from "./e2ee/megolm/Decryption.js";
import {SessionBackup} from "./e2ee/megolm/SessionBackup.js";
import {Encryption as MegOlmEncryption} from "./e2ee/megolm/Encryption.js";
import {MEGOLM_ALGORITHM} from "./e2ee/common.js";
import {RoomEncryption} from "./e2ee/RoomEncryption.js";
import {DeviceTracker} from "./e2ee/DeviceTracker.js";
import {LockMap} from "../utils/LockMap.js";
import {groupBy} from "../utils/groupBy.js";
import {
    keyFromCredential as ssssKeyFromCredential,
    readKey as ssssReadKey,
    writeKey as ssssWriteKey,
} from "./ssss/index.js";
import {SecretStorage} from "./ssss/SecretStorage.js";
import {ObservableValue} from "../observable/ObservableValue.js";

const PICKLE_KEY = "DEFAULT_KEY";
const PUSHER_KEY = "pusher";

export class Session {
    // sessionInfo contains deviceId, userId and homeServer
    constructor({storage, hsApi, sessionInfo, olm, olmWorker, platform, mediaRepository}) {
        this._platform = platform;
        this._storage = storage;
        this._hsApi = hsApi;
        this._mediaRepository = mediaRepository;
        this._syncInfo = null;
        this._sessionInfo = sessionInfo;
        this._rooms = new ObservableMap();
        this._roomUpdateCallback = (room, params) => this._rooms.update(room.id, params);
        this._user = new User(sessionInfo.userId);
        this._deviceMessageHandler = new DeviceMessageHandler({storage});
        this._olm = olm;
        this._olmUtil = null;
        this._e2eeAccount = null;
        this._deviceTracker = null;
        this._olmEncryption = null;
        this._megolmEncryption = null;
        this._megolmDecryption = null;
        this._getSyncToken = () => this.syncToken;
        this._olmWorker = olmWorker;
        this._sessionBackup = null;
        this._hasSecretStorageKey = new ObservableValue(null);

        if (olm) {
            this._olmUtil = new olm.Utility();
            this._deviceTracker = new DeviceTracker({
                storage,
                getSyncToken: this._getSyncToken,
                olmUtil: this._olmUtil,
                ownUserId: sessionInfo.userId,
                ownDeviceId: sessionInfo.deviceId,
            });
        }
        this._createRoomEncryption = this._createRoomEncryption.bind(this);
        this.needsSessionBackup = new ObservableValue(false);
    }

    get fingerprintKey() {
        return this._e2eeAccount?.identityKeys.ed25519;
    }

    get hasSecretStorageKey() {
        return this._hasSecretStorageKey;
    }

    get deviceId() {
        return this._sessionInfo.deviceId;
    }

    get userId() {
        return this._sessionInfo.userId;
    }

    // called once this._e2eeAccount is assigned
    _setupEncryption() {
        // TODO: this should all go in a wrapper in e2ee/ that is bootstrapped by passing in the account
        // and can create RoomEncryption objects and handle encrypted to_device messages and device list changes.
        const senderKeyLock = new LockMap();
        const olmDecryption = new OlmDecryption({
            account: this._e2eeAccount,
            pickleKey: PICKLE_KEY,
            olm: this._olm,
            storage: this._storage,
            now: this._platform.clock.now,
            ownUserId: this._user.id,
            senderKeyLock
        });
        this._olmEncryption = new OlmEncryption({
            account: this._e2eeAccount,
            pickleKey: PICKLE_KEY,
            olm: this._olm,
            storage: this._storage,
            now: this._platform.clock.now,
            ownUserId: this._user.id,
            olmUtil: this._olmUtil,
            senderKeyLock
        });
        this._megolmEncryption = new MegOlmEncryption({
            account: this._e2eeAccount,
            pickleKey: PICKLE_KEY,
            olm: this._olm,
            storage: this._storage,
            now: this._platform.clock.now,
            ownDeviceId: this._sessionInfo.deviceId,
        });
        this._megolmDecryption = new MegOlmDecryption({
            pickleKey: PICKLE_KEY,
            olm: this._olm,
            olmWorker: this._olmWorker,
        });
        this._deviceMessageHandler.enableEncryption({olmDecryption, megolmDecryption: this._megolmDecryption});
    }

    _createRoomEncryption(room, encryptionParams) {
        // TODO: this will actually happen when users start using the e2ee version for the first time

        // this should never happen because either a session was already synced once
        // and thus an e2ee account was created as well and _setupEncryption is called from load
        // OR
        // this is a new session and loading it will load zero rooms, thus not calling this method.
        // in this case _setupEncryption is called from beforeFirstSync, right after load,
        // so any incoming synced rooms won't be there yet
        if (!this._olmEncryption) {
            throw new Error("creating room encryption before encryption got globally enabled");
        }
        // only support megolm
        if (encryptionParams.algorithm !== MEGOLM_ALGORITHM) {
            return null;
        }
        return new RoomEncryption({
            room,
            deviceTracker: this._deviceTracker,
            olmEncryption: this._olmEncryption,
            megolmEncryption: this._megolmEncryption,
            megolmDecryption: this._megolmDecryption,
            storage: this._storage,
            sessionBackup: this._sessionBackup,
            encryptionParams,
            notifyMissingMegolmSession: () => {
                if (!this._sessionBackup) {
                    this.needsSessionBackup.set(true)
                }
            },
            clock: this._platform.clock
        });
    }

    /**
     * Enable secret storage by providing the secret storage credential.
     * This will also see if there is a megolm session backup and try to enable that if so.
     * 
     * @param  {string} type       either "passphrase" or "recoverykey"
     * @param  {string} credential either the passphrase or the recovery key, depending on the type
     * @return {Promise} resolves or rejects after having tried to enable secret storage
     */
    async enableSecretStorage(type, credential) {
        if (!this._olm) {
            throw new Error("olm required");
        }
        if (this._sessionBackup) {
            return false;
        }
        const key = await ssssKeyFromCredential(type, credential, this._storage, this._platform, this._olm);
        // and create session backup, which needs to read from accountData
        const readTxn = await this._storage.readTxn([
            this._storage.storeNames.accountData,
        ]);
        await this._createSessionBackup(key, readTxn);
        // only after having read a secret, write the key
        // as we only find out if it was good if the MAC verification succeeds
        const writeTxn = await this._storage.readWriteTxn([
            this._storage.storeNames.session,
        ]);
        try {
            ssssWriteKey(key, writeTxn);
        } catch (err) {
            writeTxn.abort();
            throw err;
        }
        await writeTxn.complete();
        this._hasSecretStorageKey.set(true);
    }

    async _createSessionBackup(ssssKey, txn) {
        const secretStorage = new SecretStorage({key: ssssKey, platform: this._platform});
        this._sessionBackup = await SessionBackup.fromSecretStorage({
            platform: this._platform,
            olm: this._olm, secretStorage,
            hsApi: this._hsApi,
            txn
        });
        if (this._sessionBackup) {
            for (const room of this._rooms.values()) {
                if (room.isEncrypted) {
                    room.enableSessionBackup(this._sessionBackup);
                }
            }
        }
        this.needsSessionBackup.set(false);
    }

    get sessionBackup() {
        return this._sessionBackup;
    }

    /** @internal */
    async createIdentity(log) {
        if (this._olm) {
            if (!this._e2eeAccount) {
                this._e2eeAccount = await E2EEAccount.create({
                    hsApi: this._hsApi,
                    olm: this._olm,
                    pickleKey: PICKLE_KEY,
                    userId: this._sessionInfo.userId,
                    deviceId: this._sessionInfo.deviceId,
                    olmWorker: this._olmWorker,
                    storage: this._storage,
                });
                log.set("keys", this._e2eeAccount.identityKeys);
                this._setupEncryption();
            }
            await this._e2eeAccount.generateOTKsIfNeeded(this._storage, log);
            await log.wrap("uploadKeys", log => this._e2eeAccount.uploadKeys(this._storage, log));
        }
    }

    /** @internal */
    async load(log) {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.session,
            this._storage.storeNames.roomSummary,
            this._storage.storeNames.roomMembers,
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
            this._storage.storeNames.pendingEvents,
        ]);
        // restore session object
        this._syncInfo = await txn.session.get("sync");
        // restore e2ee account, if any
        if (this._olm) {
            this._e2eeAccount = await E2EEAccount.load({
                hsApi: this._hsApi,
                olm: this._olm,
                pickleKey: PICKLE_KEY,
                userId: this._sessionInfo.userId,
                deviceId: this._sessionInfo.deviceId,
                olmWorker: this._olmWorker,
                txn
            });
            if (this._e2eeAccount) {
                log.set("keys", this._e2eeAccount.identityKeys);
                this._setupEncryption();
            }
        }
        const pendingEventsByRoomId = await this._getPendingEventsByRoom(txn);
        // load rooms
        const rooms = await txn.roomSummary.getAll();
        await Promise.all(rooms.map(summary => {
            const room = this.createRoom(summary.roomId, pendingEventsByRoomId.get(summary.roomId));
            return log.wrap("room", log => room.load(summary, txn, log));
        }));
    }

    dispose() {
        this._olmWorker?.dispose();
        this._sessionBackup?.dispose();
        for (const room of this._rooms.values()) {
            room.dispose();
        }
    }

    /**
     * @internal called from session container when coming back online and catchup syncs have finished.
     * @param  {Object} lastVersionResponse a response from /versions, which is polled while offline,
     *                                      and useful to store so we can later tell what capabilities
     *                                      our homeserver has.
     */
    async start(lastVersionResponse, log) {
        if (lastVersionResponse) {
            // store /versions response
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.session
            ]);
            txn.session.set("serverVersions", lastVersionResponse);
            // TODO: what can we do if this throws?
            await txn.complete();
        }
        // enable session backup, this requests the latest backup version
        if (!this._sessionBackup) {
            const txn = await this._storage.readTxn([
                this._storage.storeNames.session,
                this._storage.storeNames.accountData,
            ]);
            // try set up session backup if we stored the ssss key
            const ssssKey = await ssssReadKey(txn);
            if (ssssKey) {
                // txn will end here as this does a network request
                await this._createSessionBackup(ssssKey, txn);
            }
            this._hasSecretStorageKey.set(!!ssssKey);
        }
        // restore unfinished operations, like sending out room keys
        const opsTxn = await this._storage.readWriteTxn([
            this._storage.storeNames.operations
        ]);
        const operations = await opsTxn.operations.getAll();
        const operationsByScope = groupBy(operations, o => o.scope);

        for (const room of this._rooms.values()) {
            let roomOperationsByType;
            const roomOperations = operationsByScope.get(room.id);
            if (roomOperations) {
                roomOperationsByType = groupBy(roomOperations, r => r.type);
            }
            room.start(roomOperationsByType, log);
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

    /** @internal */
    createRoom(roomId, pendingEvents) {
        const room = new Room({
            roomId,
            getSyncToken: this._getSyncToken,
            storage: this._storage,
            emitCollectionChange: this._roomUpdateCallback,
            hsApi: this._hsApi,
            mediaRepository: this._mediaRepository,
            pendingEvents,
            user: this._user,
            createRoomEncryption: this._createRoomEncryption,
            platform: this._platform
        });
        this._rooms.add(roomId, room);
        return room;
    }

    async obtainSyncLock(syncResponse) {
        const toDeviceEvents = syncResponse.to_device?.events;
        if (Array.isArray(toDeviceEvents) && toDeviceEvents.length) {
            return await this._deviceMessageHandler.obtainSyncLock(toDeviceEvents);
        }
    }

    async prepareSync(syncResponse, lock, txn, log) {
        const toDeviceEvents = syncResponse.to_device?.events;
        if (Array.isArray(toDeviceEvents) && toDeviceEvents.length) {
            return await log.wrap("deviceMsgs", log => this._deviceMessageHandler.prepareSync(toDeviceEvents, lock, txn, log));
        }
    }

    /** @internal */
    async writeSync(syncResponse, syncFilterId, preparation, txn, log) {
        const changes = {
            syncInfo: null,
            e2eeAccountChanges: null,
        };
        const syncToken = syncResponse.next_batch;
        if (syncToken !== this.syncToken) {
            const syncInfo = {token: syncToken, filterId: syncFilterId};
            // don't modify `this` because transaction might still fail
            txn.session.set("sync", syncInfo);
            changes.syncInfo = syncInfo;
        }

        const deviceOneTimeKeysCount = syncResponse.device_one_time_keys_count;
        if (this._e2eeAccount && deviceOneTimeKeysCount) {
            changes.e2eeAccountChanges = this._e2eeAccount.writeSync(deviceOneTimeKeysCount, txn, log);
        }
    
        const deviceLists = syncResponse.device_lists;
        if (this._deviceTracker && Array.isArray(deviceLists?.changed) && deviceLists.changed.length) {
            await log.wrap("deviceLists", log => this._deviceTracker.writeDeviceChanges(deviceLists.changed, txn, log));
        }

        if (preparation) {
            await log.wrap("deviceMsgs", log => this._deviceMessageHandler.writeSync(preparation, txn, log));
        }

        // store account data
        const accountData = syncResponse["account_data"];
        if (Array.isArray(accountData?.events)) {
            for (const event of accountData.events) {
                if (typeof event.type === "string") {
                    txn.accountData.set(event);
                }
            }
        }
        return changes;
    }

    /** @internal */
    afterSync({syncInfo, e2eeAccountChanges}) {
        if (syncInfo) {
            // sync transaction succeeded, modify object state now
            this._syncInfo = syncInfo;
        }
        if (this._e2eeAccount) {
            this._e2eeAccount.afterSync(e2eeAccountChanges);
        }
    }

    /** @internal */
    async afterSyncCompleted(changes, isCatchupSync, log) {
        // we don't start uploading one-time keys until we've caught up with
        // to-device messages, to help us avoid throwing away one-time-keys that we
        // are about to receive messages for
        // (https://github.com/vector-im/riot-web/issues/2782).
        if (!isCatchupSync) {
            const needsToUploadOTKs = await this._e2eeAccount.generateOTKsIfNeeded(this._storage, log);
            if (needsToUploadOTKs) {
                await log.wrap("uploadKeys", log => this._e2eeAccount.uploadKeys(this._storage, log));
            }
        }
    }

    /** @internal */
    get syncToken() {
        return this._syncInfo?.token;
    }

    /** @internal */
    get syncFilterId() {
        return this._syncInfo?.filterId;
    }

    get user() {
        return this._user;
    }

    enablePushNotifications(enable) {
        if (enable) {
            return this._enablePush();
        } else {
            return this._disablePush();
        }
    }

    async _enablePush() {
        return this._platform.logger.run("enablePush", async log => {
            const defaultPayload = Pusher.createDefaultPayload(this._sessionInfo.id);
            const pusher = await this._platform.notificationService.enablePush(Pusher, defaultPayload);
            if (!pusher) {
                log.set("no_pusher", true);
                return false;
            }
            await pusher.enable(this._hsApi, log);
            // store pusher data, so we know we enabled it across reloads,
            // and we can disable it without too much hassle
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.session]);
            txn.session.set(PUSHER_KEY, pusher.serialize());
            await txn.complete();
            return true;
        });
    }


    async _disablePush() {
        return this._platform.logger.run("disablePush", async log => {
            await this._platform.notificationService.disablePush();
            const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
            const pusherData = await readTxn.session.get(PUSHER_KEY);
            if (!pusherData) {
                // we've disabled push in the notif service at least
                return true;
            }
            const pusher = new Pusher(pusherData);
            await pusher.disable(this._hsApi, log);
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.session]);
            txn.session.remove(PUSHER_KEY);
            await txn.complete();
            return true;
        });
    }

    async arePushNotificationsEnabled() {
        if (await this._platform.notificationService.isPushEnabled()) {
            return false;
        }
        const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
        const pusherData = await readTxn.session.get(PUSHER_KEY);
        return !!pusherData;
    }
}

export function tests() {
    function createStorageMock(session, pendingEvents = []) {
        return {
            readTxn() {
                return {
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
                };
            },
            storeNames: {}
        };
    }

    return {
        "session data is not modified until after sync": async (assert) => {
            const session = new Session({storage: createStorageMock({
                sync: {token: "a", filterId: 5}
            }), sessionInfo: {userId: ""}});
            await session.load();
            let syncSet = false;
            const syncTxn = {
                session: {
                    set(key, value) {
                        if (key === "sync") {
                            assert.equal(value.token, "b");
                            assert.equal(value.filterId, 6);
                            syncSet = true;
                        }
                    }
                }
            };
            const newSessionData = await session.writeSync({next_batch: "b"}, 6, null, syncTxn, {});
            assert(syncSet);
            assert.equal(session.syncToken, "a");
            assert.equal(session.syncFilterId, 5);
            session.afterSync(newSessionData);
            assert.equal(session.syncToken, "b");
            assert.equal(session.syncFilterId, 6);
        }
    }
}
