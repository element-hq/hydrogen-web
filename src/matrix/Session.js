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

import {Room} from "./room/Room.js";
import {ArchivedRoom} from "./room/ArchivedRoom.js";
import {RoomStatus} from "./room/common";
import {RoomBeingCreated} from "./room/RoomBeingCreated";
import {Invite} from "./room/Invite.js";
import {Pusher} from "./push/Pusher";
import {ObservableMap} from "../observable";
import {User} from "./User.js";
import {DeviceMessageHandler} from "./DeviceMessageHandler.js";
import {Account as E2EEAccount} from "./e2ee/Account.js";
import {uploadAccountAsDehydratedDevice} from "./e2ee/Dehydration.js";
import {Decryption as OlmDecryption} from "./e2ee/olm/Decryption";
import {Encryption as OlmEncryption} from "./e2ee/olm/Encryption";
import {Decryption as MegOlmDecryption} from "./e2ee/megolm/Decryption";
import {KeyLoader as MegOlmKeyLoader} from "./e2ee/megolm/decryption/KeyLoader";
import {KeyBackup} from "./e2ee/megolm/keybackup/KeyBackup";
import {Encryption as MegOlmEncryption} from "./e2ee/megolm/Encryption.js";
import {MEGOLM_ALGORITHM} from "./e2ee/common.js";
import {RoomEncryption} from "./e2ee/RoomEncryption.js";
import {DeviceTracker} from "./e2ee/DeviceTracker.js";
import {LockMap} from "../utils/LockMap";
import {groupBy} from "../utils/groupBy";
import {
    keyFromCredential as ssssKeyFromCredential,
    readKey as ssssReadKey,
    writeKey as ssssWriteKey,
    removeKey as ssssRemoveKey,
    keyFromDehydratedDeviceKey as createSSSSKeyFromDehydratedDeviceKey
} from "./ssss/index";
import {SecretStorage} from "./ssss/SecretStorage";
import {ObservableValue, RetainedObservableValue} from "../observable/ObservableValue";

const PICKLE_KEY = "DEFAULT_KEY";
const PUSHER_KEY = "pusher";

export class Session {
    // sessionInfo contains deviceId, userId and homeserver
    constructor({storage, hsApi, sessionInfo, olm, olmWorker, platform, mediaRepository}) {
        this._platform = platform;
        this._storage = storage;
        this._hsApi = hsApi;
        this._mediaRepository = mediaRepository;
        this._syncInfo = null;
        this._sessionInfo = sessionInfo;
        this._rooms = new ObservableMap();
        this._roomUpdateCallback = (room, params) => this._rooms.update(room.id, params);
        this._activeArchivedRooms = new Map();
        this._invites = new ObservableMap();
        this._inviteUpdateCallback = (invite, params) => this._invites.update(invite.id, params);
        this._roomsBeingCreatedUpdateCallback = (rbc, params) => {
            if (rbc.isCancelled) {
                this._roomsBeingCreated.remove(rbc.id);
            } else {
                this._roomsBeingCreated.update(rbc.id, params)
            }
        };
        this._roomsBeingCreated = new ObservableMap();
        this._user = new User(sessionInfo.userId);
        this._deviceMessageHandler = new DeviceMessageHandler({storage});
        this._olm = olm;
        this._olmUtil = null;
        this._e2eeAccount = null;
        this._deviceTracker = null;
        this._olmEncryption = null;
        this._keyLoader = null;
        this._megolmEncryption = null;
        this._megolmDecryption = null;
        this._getSyncToken = () => this.syncToken;
        this._olmWorker = olmWorker;
        this._keyBackup = new ObservableValue(undefined);
        this._observedRoomStatus = new Map();

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
        this._forgetArchivedRoom = this._forgetArchivedRoom.bind(this);
        this.needsKeyBackup = new ObservableValue(false);
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
        const olmDecryption = new OlmDecryption(
            this._e2eeAccount,
            PICKLE_KEY,
            this._platform.clock.now,
            this._user.id,
            this._olm,
            senderKeyLock
        );
        this._olmEncryption = new OlmEncryption(
            this._e2eeAccount,
            PICKLE_KEY,
            this._olm,
            this._storage,
            this._platform.clock.now,
            this._user.id,
            this._olmUtil,
            senderKeyLock
        );
        this._keyLoader = new MegOlmKeyLoader(this._olm, PICKLE_KEY, 20);
        this._megolmEncryption = new MegOlmEncryption({
            account: this._e2eeAccount,
            pickleKey: PICKLE_KEY,
            olm: this._olm,
            storage: this._storage,
            keyLoader: this._keyLoader,
            now: this._platform.clock.now,
            ownDeviceId: this._sessionInfo.deviceId,
        });
        this._megolmDecryption = new MegOlmDecryption(this._keyLoader, this._olmWorker);
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
            keyBackup: this._keyBackup?.get(),
            encryptionParams,
            notifyMissingMegolmSession: () => {
                if (!this._keyBackup.get()) {
                    this.needsKeyBackup.set(true)
                }
            },
            clock: this._platform.clock
        });
    }

    /**
     * Enable secret storage by providing the secret storage credential.
     * This will also see if there is a megolm key backup and try to enable that if so.
     *
     * @param  {string} type       either "passphrase" or "recoverykey"
     * @param  {string} credential either the passphrase or the recovery key, depending on the type
     * @return {Promise} resolves or rejects after having tried to enable secret storage
     */
    enableSecretStorage(type, credential, log = undefined) {
        return this._platform.logger.wrapOrRun(log, "enable secret storage", async log => {
            if (!this._olm) {
                throw new Error("olm required");
            }
            if (this._keyBackup.get()) {
                this._keyBackup.get().dispose();
                this._keyBackup.set(null);
            }
            const key = await ssssKeyFromCredential(type, credential, this._storage, this._platform, this._olm);
            // and create key backup, which needs to read from accountData
            const readTxn = await this._storage.readTxn([
                this._storage.storeNames.accountData,
            ]);
            if (await this._createKeyBackup(key, readTxn, log)) {
                // only after having read a secret, write the key
                // as we only find out if it was good if the MAC verification succeeds
                await this._writeSSSSKey(key, log);
                this._keyBackup.get().flush(log);
                return key;
            } else {
                throw new Error("Could not read key backup with the given key");
            }
        });
    }

    async _writeSSSSKey(key, log) {
        // we're going to write the 4S key, and also the backup version.
        // this way, we can detect when we enter a key for a new backup version
        // and mark all inbound sessions to be backed up again
        const keyBackup = this._keyBackup.get();
        if (!keyBackup) {
            return;
        }
        const backupVersion = keyBackup.version;
        const writeTxn = await this._storage.readWriteTxn([
            this._storage.storeNames.session,
            this._storage.storeNames.inboundGroupSessions,
        ]);
        try {
            const previousBackupVersion = await ssssWriteKey(key, backupVersion, writeTxn);
            log.set("previousBackupVersion", previousBackupVersion);
            log.set("backupVersion", backupVersion);
            if (!!previousBackupVersion && previousBackupVersion !== backupVersion) {
                const amountMarked = await keyBackup.markAllForBackup(writeTxn);
                log.set("amountMarkedForBackup", amountMarked);
            }
        } catch (err) {
            writeTxn.abort();
            throw err;
        }
        await writeTxn.complete();
    }

    async disableSecretStorage() {
        const writeTxn = await this._storage.readWriteTxn([
            this._storage.storeNames.session,
        ]);
        try {
            ssssRemoveKey(writeTxn);
        } catch (err) {
            writeTxn.abort();
            throw err;
        }
        await writeTxn.complete();
        if (this._keyBackup.get()) {
            for (const room of this._rooms.values()) {
                if (room.isEncrypted) {
                    room.enableKeyBackup(undefined);
                }
            }
            this._keyBackup.get().dispose();
            this._keyBackup.set(null);
        }
    }

    _createKeyBackup(ssssKey, txn, log) {
        return log.wrap("enable key backup", async log => {
            try {
                const secretStorage = new SecretStorage({key: ssssKey, platform: this._platform});
                const keyBackup = await KeyBackup.fromSecretStorage(
                    this._platform,
                    this._olm,
                    secretStorage,
                    this._hsApi,
                    this._keyLoader,
                    this._storage,
                    txn
                );
                if (keyBackup) {
                    for (const room of this._rooms.values()) {
                        if (room.isEncrypted) {
                            room.enableKeyBackup(keyBackup);
                        }
                    }
                    this._keyBackup.set(keyBackup);
                    return true;
                }
            } catch (err) {
                log.catch(err);
            }
            return false;
        });
    }

    /**
     * @type {ObservableValue<KeyBackup | undefined | null}
     *  - `undefined` means, we're not done with catchup sync yet and haven't checked yet if key backup is configured
     *  - `null` means we've checked and key backup hasn't been configured correctly or at all.
     */
    get keyBackup() {
        return this._keyBackup;
    }

    get hasIdentity() {
        return !!this._e2eeAccount;
    }

    /** @internal */
    async createIdentity(log) {
        if (this._olm) {
            if (!this._e2eeAccount) {
                this._e2eeAccount = await this._createNewAccount(this._sessionInfo.deviceId, this._storage);
                log.set("keys", this._e2eeAccount.identityKeys);
                this._setupEncryption();
            }
            await this._e2eeAccount.generateOTKsIfNeeded(this._storage, log);
            await log.wrap("uploadKeys", log => this._e2eeAccount.uploadKeys(this._storage, false, log));
        }
    }

    /** @internal */
    async dehydrateIdentity(dehydratedDevice, log) {
        log.set("deviceId", dehydratedDevice.deviceId);
        if (!this._olm) {
            log.set("no_olm", true);
            return false;
        }
        if (dehydratedDevice.deviceId !== this.deviceId) {
            log.set("wrong_device", true);
            return false;
        }
        if (this._e2eeAccount) {
            log.set("account_already_setup", true);
            return false;
        }
        if (!await dehydratedDevice.claim(this._hsApi, log)) {
            log.set("already_claimed", true);
            return false;
        }
        this._e2eeAccount = await E2EEAccount.adoptDehydratedDevice({
            dehydratedDevice,
            hsApi: this._hsApi,
            olm: this._olm,
            pickleKey: PICKLE_KEY,
            userId: this._sessionInfo.userId,
            olmWorker: this._olmWorker,
            deviceId: this.deviceId,
            storage: this._storage,
        });
        log.set("keys", this._e2eeAccount.identityKeys);
        this._setupEncryption();
        return true;
    }

    _createNewAccount(deviceId, storage = undefined) {
        // storage is optional and if omitted the account won't be persisted (useful for dehydrating devices)
        return E2EEAccount.create({
            hsApi: this._hsApi,
            olm: this._olm,
            pickleKey: PICKLE_KEY,
            userId: this._sessionInfo.userId,
            olmWorker: this._olmWorker,
            deviceId,
            storage,
        });
    }

    setupDehydratedDevice(key, log = null) {
        return this._platform.logger.wrapOrRun(log, "setupDehydratedDevice", async log => {
            const dehydrationAccount = await this._createNewAccount("temp-device-id");
            try {
                const deviceId = await uploadAccountAsDehydratedDevice(
                    dehydrationAccount, this._hsApi, key, "Dehydrated device", log);
                log.set("deviceId", deviceId);
                return deviceId;
            } finally {
                dehydrationAccount.dispose();
            }
        });
    }

    /** @internal */
    async load(log) {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.session,
            this._storage.storeNames.roomSummary,
            this._storage.storeNames.invites,
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
        // load invites
        const invites = await txn.invites.getAll();
        const inviteLoadPromise = Promise.all(invites.map(async inviteData => {
            const invite = this.createInvite(inviteData.roomId);
            log.wrap("invite", log => invite.load(inviteData, log));
            this._invites.add(invite.id, invite);
        }));
        // load rooms
        const rooms = await txn.roomSummary.getAll();
        const roomLoadPromise = Promise.all(rooms.map(async summary => {
            const room = this.createJoinedRoom(summary.roomId, pendingEventsByRoomId.get(summary.roomId));
            await log.wrap("room", log => room.load(summary, txn, log));
            this._rooms.add(room.id, room);
        }));
        // load invites and rooms in parallel
        await Promise.all([inviteLoadPromise, roomLoadPromise]);
        for (const [roomId, invite] of this.invites) {
            const room = this.rooms.get(roomId);
            if (room) {
                room.setInvite(invite);
            }
        }
    }

    dispose() {
        this._olmWorker?.dispose();
        this._olmWorker = undefined;
        this._keyBackup.get()?.dispose();
        this._keyBackup.set(undefined);
        this._megolmDecryption?.dispose();
        this._megolmDecryption = undefined;
        this._e2eeAccount?.dispose();
        this._e2eeAccount = undefined;
        for (const room of this._rooms.values()) {
            room.dispose();
        }
        this._rooms = undefined;
    }

    /**
     * @internal called from session container when coming back online and catchup syncs have finished.
     * @param  {Object} lastVersionResponse a response from /versions, which is polled while offline,
     *                                      and useful to store so we can later tell what capabilities
     *                                      our homeserver has.
     */
    async start(lastVersionResponse, dehydratedDevice, log) {
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
        if (!this._keyBackup.get()) {
            if (dehydratedDevice) {
                await log.wrap("SSSSKeyFromDehydratedDeviceKey", async log => {
                    const ssssKey = await createSSSSKeyFromDehydratedDeviceKey(dehydratedDevice.key, this._storage, this._platform);
                    if (ssssKey) {
                        log.set("success", true);
                        await this._writeSSSSKey(ssssKey);
                    }
                });
            }
            const txn = await this._storage.readTxn([
                this._storage.storeNames.session,
                this._storage.storeNames.accountData,
            ]);
            // try set up session backup if we stored the ssss key
            const ssssKey = await ssssReadKey(txn);
            if (ssssKey) {
                // txn will end here as this does a network request
                if (await this._createKeyBackup(ssssKey, txn, log)) {
                    this._keyBackup.get()?.flush(log);
                }
            }
            if (!this._keyBackup.get()) {
                // null means key backup isn't configured yet
                // as opposed to undefined, which means we're still checking
                this._keyBackup.set(null);
            }
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

    findDirectMessageForUserId(userId) {
        for (const [,room] of this._rooms) {
            if (room.isDirectMessageForUserId(userId)) {
                return room;
            }
        }
        for (const [,invite] of this._invites) {
            if (invite.isDirectMessageForUserId(userId)) {
                return invite;
            }
        }
    }

    /** @internal */
    createJoinedRoom(roomId, pendingEvents) {
        return new Room({
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
    }

    /** @internal */
    _createArchivedRoom(roomId) {
        const room = new ArchivedRoom({
            roomId,
            getSyncToken: this._getSyncToken,
            storage: this._storage,
            emitCollectionChange: () => {},
            releaseCallback: () => this._activeArchivedRooms.delete(roomId),
            forgetCallback: this._forgetArchivedRoom,
            hsApi: this._hsApi,
            mediaRepository: this._mediaRepository,
            user: this._user,
            createRoomEncryption: this._createRoomEncryption,
            platform: this._platform
        });
        this._activeArchivedRooms.set(roomId, room);
        return room;
    }

    get invites() {
        return this._invites;
    }

    /** @internal */
    createInvite(roomId) {
        return new Invite({
            roomId,
            hsApi: this._hsApi,
            emitCollectionUpdate: this._inviteUpdateCallback,
            mediaRepository: this._mediaRepository,
            user: this._user,
            platform: this._platform,
        });
    }

    get roomsBeingCreated() {
        return this._roomsBeingCreated;
    }

    createRoom(options) {
        let roomBeingCreated;
        this._platform.logger.runDetached("create room", async log => {
            const id = `local-${Math.floor(this._platform.random() * Number.MAX_SAFE_INTEGER)}`;
            roomBeingCreated = new RoomBeingCreated(
                id, options, this._roomsBeingCreatedUpdateCallback,
                this._mediaRepository, this._platform, log);
            this._roomsBeingCreated.set(id, roomBeingCreated);
            const promises = [roomBeingCreated.create(this._hsApi, log)];
            const loadProfiles = options.loadProfiles !== false; // default to true
            if (loadProfiles) {
                promises.push(roomBeingCreated.loadProfiles(this._hsApi, log));
            }
            await Promise.all(promises);
            // we should now know the roomId, check if the room was synced before we received
            // the room id. Replace the room being created with the synced room.
            if (roomBeingCreated.roomId) {
                if (this.rooms.get(roomBeingCreated.roomId)) {
                    this._tryReplaceRoomBeingCreated(roomBeingCreated.roomId, log);
                }
                await roomBeingCreated.adjustDirectMessageMapIfNeeded(this._user, this._storage, this._hsApi, log);
            }
        });
        return roomBeingCreated;
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
            e2eeAccountChanges: null
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
            changes.hasNewRoomKeys = await log.wrap("deviceMsgs", log => this._deviceMessageHandler.writeSync(preparation, txn, log));
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
                await log.wrap("uploadKeys", log => this._e2eeAccount.uploadKeys(this._storage, false, log));
            }
        }
        if (changes.hasNewRoomKeys) {
            this._keyBackup.get()?.flush(log);
        }
    }

    _tryReplaceRoomBeingCreated(roomId, log) {
        for (const [,roomBeingCreated] of this._roomsBeingCreated) {
            if (roomBeingCreated.roomId === roomId) {
                const observableStatus = this._observedRoomStatus.get(roomBeingCreated.id);
                if (observableStatus) {
                    log.log(`replacing room being created`)
                       .set("localId", roomBeingCreated.id)
                       .set("roomId", roomBeingCreated.roomId);
                    observableStatus.set(observableStatus.get() | RoomStatus.Replaced);
                }
                roomBeingCreated.dispose();
                this._roomsBeingCreated.remove(roomBeingCreated.id);
                return;
            }
        }
    }

    applyRoomCollectionChangesAfterSync(inviteStates, roomStates, archivedRoomStates, log) {
        // update the collections after sync
        for (const rs of roomStates) {
            if (rs.shouldAdd) {
                this._rooms.add(rs.id, rs.room);
                this._tryReplaceRoomBeingCreated(rs.id, log);
            } else if (rs.shouldRemove) {
                this._rooms.remove(rs.id);
            }
        }
        for (const is of inviteStates) {
            if (is.shouldAdd) {
                this._invites.add(is.id, is.invite);
            } else if (is.shouldRemove) {
                this._invites.remove(is.id);
            }
        }
        // now all the collections are updated, update the room status
        // so any listeners to the status will find the collections
        // completely up to date
        if (this._observedRoomStatus.size !== 0) {
            for (const ars of archivedRoomStates) {
                if (ars.shouldAdd) {
                    this._observedRoomStatus.get(ars.id)?.set(RoomStatus.Archived);
                }
            }
            for (const rs of roomStates) {
                if (rs.shouldAdd) {
                    this._observedRoomStatus.get(rs.id)?.set(RoomStatus.Joined);
                }
            }
            for (const is of inviteStates) {
                const statusObservable = this._observedRoomStatus.get(is.id);
                if (statusObservable) {
                    const withInvited = statusObservable.get() | RoomStatus.Invited;
                    if (is.shouldAdd) {
                        statusObservable.set(withInvited);
                    } else if (is.shouldRemove) {
                        const withoutInvited = withInvited ^ RoomStatus.Invited;
                        statusObservable.set(withoutInvited);
                    }
                }
            }
        }
    }

    _forgetArchivedRoom(roomId) {
        const statusObservable = this._observedRoomStatus.get(roomId);
        if (statusObservable) {
            statusObservable.set((statusObservable.get() | RoomStatus.Archived) ^ RoomStatus.Archived);
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

    get mediaRepository() {
        return this._mediaRepository;
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
        if (!await this._platform.notificationService.isPushEnabled()) {
            return false;
        }
        const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
        const pusherData = await readTxn.session.get(PUSHER_KEY);
        return !!pusherData;
    }

    async checkPusherEnabledOnHomeserver() {
        const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
        const pusherData = await readTxn.session.get(PUSHER_KEY);
        if (!pusherData) {
            return false;
        }
        const myPusher = new Pusher(pusherData);
        const serverPushersData = await this._hsApi.getPushers().response();
        const serverPushers = (serverPushersData?.pushers || []).map(data => new Pusher(data));
        return serverPushers.some(p => p.equals(myPusher));
    }

    async getRoomStatus(roomId) {
        const isBeingCreated = !!this._roomsBeingCreated.get(roomId);
        if (isBeingCreated) {
            return RoomStatus.BeingCreated;
        }
        const isJoined = !!this._rooms.get(roomId);
        if (isJoined) {
            return RoomStatus.Joined;
        } else {
            const isInvited = !!this._invites.get(roomId);
            const txn = await this._storage.readTxn([this._storage.storeNames.archivedRoomSummary]);
            const isArchived = await txn.archivedRoomSummary.has(roomId);
            if (isInvited && isArchived) {
                return RoomStatus.Invited | RoomStatus.Archived;
            } else if (isInvited) {
                return RoomStatus.Invited;
            } else if (isArchived) {
                return RoomStatus.Archived;
            } else {
                return RoomStatus.None;
            }
        }
    }

    async observeRoomStatus(roomId) {
        let observable = this._observedRoomStatus.get(roomId);
        if (!observable) {
            const status = await this.getRoomStatus(roomId);
            observable = new RetainedObservableValue(status, () => {
                this._observedRoomStatus.delete(roomId);
            });

            this._observedRoomStatus.set(roomId, observable);
        }
        return observable;
    }

    /**
    Creates an empty (summary isn't loaded) the archived room if it isn't
    loaded already, assuming sync will either remove it (when rejoining) or
    write a full summary adopting it from the joined room when leaving

    @internal
    */
    createOrGetArchivedRoomForSync(roomId) {
        let archivedRoom = this._activeArchivedRooms.get(roomId);
        if (archivedRoom) {
            archivedRoom.retain();
        } else {
            archivedRoom = this._createArchivedRoom(roomId);
        }
        return archivedRoom;
    }

    loadArchivedRoom(roomId, log = null) {
        return this._platform.logger.wrapOrRun(log, "loadArchivedRoom", async log => {
            log.set("id", roomId);
            const activeArchivedRoom = this._activeArchivedRooms.get(roomId);
            if (activeArchivedRoom) {
                activeArchivedRoom.retain();
                return activeArchivedRoom;
            }
            const txn = await this._storage.readTxn([
                this._storage.storeNames.archivedRoomSummary,
                this._storage.storeNames.roomMembers,
            ]);
            const summary = await txn.archivedRoomSummary.get(roomId);
            if (summary) {
                const room = this._createArchivedRoom(roomId);
                await room.load(summary, txn, log);
                return room;
            }
        });
    }

    joinRoom(roomIdOrAlias, log = null) {
        return this._platform.logger.wrapOrRun(log, "joinRoom", async log => {
            const body = await this._hsApi.joinIdOrAlias(roomIdOrAlias, {log}).response();
            return body.room_id;
        });
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
                    },
                    invites: {
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
