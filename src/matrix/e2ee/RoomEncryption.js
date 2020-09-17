/*
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

import {MEGOLM_ALGORITHM, DecryptionSource} from "./common.js";
import {groupBy} from "../../utils/groupBy.js";
import {mergeMap} from "../../utils/mergeMap.js";
import {makeTxnId} from "../common.js";

const ENCRYPTED_TYPE = "m.room.encrypted";

export class RoomEncryption {
    constructor({room, deviceTracker, olmEncryption, megolmEncryption, megolmDecryption, encryptionParams, storage, sessionBackup}) {
        this._room = room;
        this._deviceTracker = deviceTracker;
        this._olmEncryption = olmEncryption;
        this._megolmEncryption = megolmEncryption;
        this._megolmDecryption = megolmDecryption;
        // content of the m.room.encryption event
        this._encryptionParams = encryptionParams;

        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
        this._megolmSyncCache = this._megolmDecryption.createSessionCache();
        // not `event_id`, but an internal event id passed in to the decrypt methods
        this._eventIdsByMissingSession = new Map();
        this._senderDeviceCache = new Map();
        this._storage = storage;
        this._sessionBackup = sessionBackup;
    }

    enableSessionBackup(sessionBackup) {
        if (this._sessionBackup) {
            return;
        }
        this._sessionBackup = sessionBackup;
        // TODO: query session backup for all missing sessions so far
        // can we query multiple? no, only for sessionId, all for room, or all
    }

    notifyTimelineClosed() {
        // empty the backfill cache when closing the timeline
        this._megolmBackfillCache.dispose();
        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
        this._senderDeviceCache = new Map();    // purge the sender device cache
    }

    async writeMemberChanges(memberChanges, txn) {
        const memberChangesArray = Array.from(memberChanges.values());
        if (memberChangesArray.some(m => m.hasLeft)) {
            this._megolmEncryption.discardOutboundSession(this._room.id, txn);
        }
        if (memberChangesArray.some(m => m.hasJoined)) {
            await this._addShareRoomKeyOperationForNewMembers(memberChangesArray, txn);
        }
        await this._deviceTracker.writeMemberChanges(this._room, memberChanges, txn);
    }

    // this happens before entries exists, as they are created by the syncwriter
    // but we want to be able to map it back to something in the timeline easily
    // when retrying decryption.
    async prepareDecryptAll(events, source, isTimelineOpen, txn) {
        const errors = [];
        const validEvents = [];
        for (const event of events) {
            if (event.redacted_because || event.unsigned?.redacted_because) {
                continue;
            }
            if (event.content?.algorithm !== MEGOLM_ALGORITHM) {
                errors.set(event.event_id, new Error("Unsupported algorithm: " + event.content?.algorithm));
            }
            validEvents.push(event);
        }
        let customCache;
        let sessionCache;
        if (source === DecryptionSource.Sync) {
            sessionCache = this._megolmSyncCache;
        } else if (source === DecryptionSource.Timeline) {
            sessionCache = this._megolmBackfillCache;
        } else if (source === DecryptionSource.Retry) {
            // when retrying, we could have mixed events from at the bottom of the timeline (sync)
            // and somewhere else, so create a custom cache we use just for this operation.
            customCache = this._megolmEncryption.createSessionCache();
            sessionCache = customCache;
        } else {
            throw new Error("Unknown source: " + source);
        }
        const preparation = await this._megolmDecryption.prepareDecryptAll(
            this._room.id, validEvents, sessionCache, txn);
        if (customCache) {
            customCache.dispose();
        }
        return new DecryptionPreparation(preparation, errors, {isTimelineOpen}, this);
    }

    async _processDecryptionResults(results, errors, flags, txn) {
        for (const error of errors.values()) {
            if (error.code === "MEGOLM_NO_SESSION") {
                this._addMissingSessionEvent(error.event);
            }
        }
        if (flags.isTimelineOpen) {
            for (const result of results.values()) {
                await this._verifyDecryptionResult(result, txn);
            }
        }
    }

    async _verifyDecryptionResult(result, txn) {
        let device = this._senderDeviceCache.get(result.senderCurve25519Key);
        if (!device) {
            device = await this._deviceTracker.getDeviceByCurve25519Key(result.senderCurve25519Key, txn);
            this._senderDeviceCache.set(result.senderCurve25519Key, device);
        }
        if (device) {
            result.setDevice(device);
        } else if (!this._room.isTrackingMembers) {
            result.setRoomNotTrackedYet();
        }
    }

    _addMissingSessionEvent(event) {
        const senderKey = event.content?.["sender_key"];
        const sessionId = event.content?.["session_id"];
        const key = `${senderKey}|${sessionId}`;
        let eventIds = this._eventIdsByMissingSession.get(key);
        // new missing session
        if (!eventIds) {
            this._requestMissingSessionFromBackup(sessionId).catch(err => {
                console.error(`Could not get session ${sessionId} from backup`, err);
            });
            eventIds = new Set();
            this._eventIdsByMissingSession.set(key, eventIds);
        }
        eventIds.add(event.event_id);
    }

    async _requestMissingSessionFromBackup(sessionId) {
        if (!this._sessionBackup) {
            // somehow prompt for passphrase here
            return;
        }
        const session = await this._sessionBackup.getSession(this._room.id, sessionId);
        if (session?.algorithm === MEGOLM_ALGORITHM) {
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.inboundGroupSessions]);
            let roomKey;
            try {
                roomKey = await this._megolmDecryption.addRoomKeyFromBackup(
                    this._room.id, sessionId, session, txn);
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();

            if (roomKey) {
                // this will call into applyRoomKeys below
                await this._room.notifyRoomKeys([roomKey]);
            }
        } else if (session?.algorithm) {
            console.info(`Backed-up session of unknown algorithm: ${session.algorithm}`);
        }
    }

    /**
     * @type {RoomKeyDescription}
     * @property {RoomKeyDescription} senderKey the curve25519 key of the sender
     * @property {RoomKeyDescription} sessionId
     * 
     * 
     * @param  {Array<RoomKeyDescription>} roomKeys
     * @return {Array<string>} the event ids that should be retried to decrypt
     */
    applyRoomKeys(roomKeys) {
        // retry decryption with the new sessions
        const retryEventIds = [];
        for (const roomKey of roomKeys) {
            const key = `${roomKey.senderKey}|${roomKey.sessionId}`;
            const entriesForSession = this._eventIdsByMissingSession.get(key);
            if (entriesForSession) {
                this._eventIdsByMissingSession.delete(key);
                retryEventIds.push(...entriesForSession);
            }
        }
        return retryEventIds;
    }

    async encrypt(type, content, hsApi) {
        await this._deviceTracker.trackRoom(this._room);
        const megolmResult = await this._megolmEncryption.encrypt(this._room.id, type, content, this._encryptionParams);
        if (megolmResult.roomKeyMessage) {
            this._shareNewRoomKey(megolmResult.roomKeyMessage, hsApi);
        }
        return {
            type: ENCRYPTED_TYPE,
            content: megolmResult.content
        };
    }

    needsToShareKeys(memberChanges) {
        for (const m of memberChanges.values()) {
            if (m.hasJoined) {
                return true;
            }
        }
        return false;
    }

    async _shareNewRoomKey(roomKeyMessage, hsApi) {
        const devices = await this._deviceTracker.devicesForTrackedRoom(this._room.id, hsApi);
        const userIds = Array.from(devices.reduce((set, device) => set.add(device.userId), new Set()));

        // store operation for room key share, in case we don't finish here
        const writeOpTxn = await this._storage.readWriteTxn([this._storage.storeNames.operations]);
        let operationId;
        try {
            operationId = this._writeRoomKeyShareOperation(roomKeyMessage, userIds, writeOpTxn);
        } catch (err) {
            writeOpTxn.abort();
            throw err;
        }
        await writeOpTxn.complete();
        // TODO: at this point we have the room key stored, and the rest is sort of optional
        // it would be nice if we could signal SendQueue that any error from here on is non-fatal and
        // return the encrypted payload.

        // send the room key
        await this._sendRoomKey(roomKeyMessage, devices, hsApi);

        // remove the operation
        const removeOpTxn = await this._storage.readWriteTxn([this._storage.storeNames.operations]);
        try {
            removeOpTxn.operations.remove(operationId);
        } catch (err) {
            removeOpTxn.abort();
            throw err;
        }
        await removeOpTxn.complete();
    }

    async _addShareRoomKeyOperationForNewMembers(memberChangesArray, txn) {
        const userIds = memberChangesArray.filter(m => m.hasJoined).map(m => m.userId);
        const roomKeyMessage = await this._megolmEncryption.createRoomKeyMessage(
            this._room.id, txn);
        if (roomKeyMessage) {
            this._writeRoomKeyShareOperation(roomKeyMessage, userIds, txn);
        }
    }

    _writeRoomKeyShareOperation(roomKeyMessage, userIds, txn) {
        const id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
        txn.operations.add({
            id,
            type: "share_room_key",
            scope: this._room.id,
            userIds,
            roomKeyMessage,
        });
        return id;
    }

    async flushPendingRoomKeyShares(hsApi, operations = null) {
        if (!operations) {
            const txn = await this._storage.readTxn([this._storage.storeNames.operations]);
            operations = await txn.operations.getAllByTypeAndScope("share_room_key", this._room.id);
        }
        for (const operation of operations) {
            // just to be sure
            if (operation.type !== "share_room_key") {
                continue;
            }
            const devices = await this._deviceTracker.devicesForRoomMembers(this._room.id, operation.userIds, hsApi);
            await this._sendRoomKey(operation.roomKeyMessage, devices, hsApi);
            const removeTxn = await this._storage.readWriteTxn([this._storage.storeNames.operations]);
            try {
                removeTxn.operations.remove(operation.id);
            } catch (err) {
                removeTxn.abort();
                throw err;
            }
            await removeTxn.complete();
        }
    }

    async _sendRoomKey(roomKeyMessage, devices, hsApi) {
        const messages = await this._olmEncryption.encrypt(
            "m.room_key", roomKeyMessage, devices, hsApi);
        await this._sendMessagesToDevices(ENCRYPTED_TYPE, messages, hsApi);
    }

    async _sendMessagesToDevices(type, messages, hsApi) {
        const messagesByUser = groupBy(messages, message => message.device.userId);
        const payload = {
            messages: Array.from(messagesByUser.entries()).reduce((userMap, [userId, messages]) => {
                userMap[userId] = messages.reduce((deviceMap, message) => {
                    deviceMap[message.device.deviceId] = message.content;
                    return deviceMap;
                }, {});
                return userMap;
            }, {})
        };
        const txnId = makeTxnId();
        await hsApi.sendToDevice(type, payload, txnId).response();
    }
}

/**
 * wrappers around megolm decryption classes to be able to post-process
 * the decryption results before turning them
 */
class DecryptionPreparation {
    constructor(megolmDecryptionPreparation, extraErrors, flags, roomEncryption) {
        this._megolmDecryptionPreparation = megolmDecryptionPreparation;
        this._extraErrors = extraErrors;
        this._flags = flags;
        this._roomEncryption = roomEncryption;
    }

    async decrypt() {
        return new DecryptionChanges(
            await this._megolmDecryptionPreparation.decrypt(),
            this._extraErrors,
            this._flags,
            this._roomEncryption);
    }

    dispose() {
        this._megolmDecryptionPreparation.dispose();
    }
}

class DecryptionChanges {
    constructor(megolmDecryptionChanges, extraErrors, flags, roomEncryption) {
        this._megolmDecryptionChanges = megolmDecryptionChanges;
        this._extraErrors = extraErrors;
        this._flags = flags;
        this._roomEncryption = roomEncryption;
    }

    async write(txn) {
        const {results, errors} = await this._megolmDecryptionChanges.write(txn);
        mergeMap(this._extraErrors, errors);
        await this._roomEncryption._processDecryptionResults(results, errors, this._flags, txn);
        return new BatchDecryptionResult(results, errors);
    }
}

class BatchDecryptionResult {
    constructor(results, errors) {
        this.results = results;
        this.errors = errors;
    }

    applyToEntries(entries) {
        for (const entry of entries) {
            const result = this.results.get(entry.id);
            if (result) {
                entry.setDecryptionResult(result);
            } else {
                const error = this.errors.get(entry.id);
                if (error) {
                    entry.setDecryptionError(error);
                }
            }
        }
    }
}
