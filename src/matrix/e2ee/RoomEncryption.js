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
// how often ensureMessageKeyIsShared can check if it needs to
// create a new outbound session
// note that encrypt could still create a new session
const MIN_PRESHARE_INTERVAL = 60 * 1000; // 1min

function encodeMissingSessionKey(senderKey, sessionId) {
    return `${senderKey}|${sessionId}`;
}

function decodeMissingSessionKey(key) {
    const [senderKey, sessionId] = key.split("|");
    return {senderKey, sessionId};
}

export class RoomEncryption {
    constructor({room, deviceTracker, olmEncryption, megolmEncryption, megolmDecryption, encryptionParams, storage, sessionBackup, notifyMissingMegolmSession, clock}) {
        this._room = room;
        this._deviceTracker = deviceTracker;
        this._olmEncryption = olmEncryption;
        this._megolmEncryption = megolmEncryption;
        this._megolmDecryption = megolmDecryption;
        // content of the m.room.encryption event
        this._encryptionParams = encryptionParams;

        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
        this._megolmSyncCache = this._megolmDecryption.createSessionCache(1);
        // session => event ids of messages we tried to decrypt and the session was missing
        this._missingSessions = new SessionToEventIdsMap();
        // sessions that may or may not be missing, but that while
        // looking for a particular session came up as a candidate and were
        // added to the cache to prevent further lookups from storage
        this._missingSessionCandidates = new SessionToEventIdsMap();
        this._senderDeviceCache = new Map();
        this._storage = storage;
        this._sessionBackup = sessionBackup;
        this._notifyMissingMegolmSession = notifyMissingMegolmSession;
        this._clock = clock;
        this._disposed = false;
        this._isFlushingRoomKeyShares = false;
        this._lastKeyPreShareTime = null;
    }

    async enableSessionBackup(sessionBackup) {
        if (this._sessionBackup) {
            return;
        }
        this._sessionBackup = sessionBackup;
        for(const {senderKey, sessionId} of this._missingSessions.getSessions()) {
            await this._requestMissingSessionFromBackup(senderKey, sessionId, null);
        }
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
        const errors = new Map();
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
            customCache = this._megolmDecryption.createSessionCache();
            sessionCache = customCache;
        } else {
            throw new Error("Unknown source: " + source);
        }
        const preparation = await this._megolmDecryption.prepareDecryptAll(
            this._room.id, validEvents, sessionCache, txn);
        if (customCache) {
            customCache.dispose();
        }
        return new DecryptionPreparation(preparation, errors, {isTimelineOpen, source}, this, events);
    }

    async _processDecryptionResults(events, results, errors, flags, txn) {
        for (const event of events) {
            const error = errors.get(event.event_id);
            if (error?.code === "MEGOLM_NO_SESSION") {
                this._addMissingSessionEvent(event, flags.source);
            } else {
                this._missingSessions.removeEvent(event);
                this._missingSessionCandidates.removeEvent(event);
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

    _addMissingSessionEvent(event, source) {
        const isNewSession = this._missingSessions.addEvent(event);
        if (isNewSession) {
            const senderKey = event.content?.["sender_key"];
            const sessionId = event.content?.["session_id"];
            this._requestMissingSessionFromBackup(senderKey, sessionId, source);
        }
    }

    async _requestMissingSessionFromBackup(senderKey, sessionId, source) {
        // if the message came from sync, wait 10s to see if the room key arrives,
        // and only after that proceed to request from backup
        if (source === DecryptionSource.Sync) {
            await this._clock.createTimeout(10000).elapsed();
            if (this._disposed || !this._missingSessions.hasSession(senderKey, sessionId)) {
                return;
            }
        }
        // show prompt to enable secret storage
        if (!this._sessionBackup) {
            this._notifyMissingMegolmSession();
            return;
        }

        try {
            const session = await this._sessionBackup.getSession(this._room.id, sessionId);
            if (session?.algorithm === MEGOLM_ALGORITHM) {
                if (session["sender_key"] !== senderKey) {
                    console.warn("Got session key back from backup with different sender key, ignoring", {session, senderKey});
                    return;
                }
                const txn = this._storage.readWriteTxn([this._storage.storeNames.inboundGroupSessions]);
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
                    // this will reattempt decryption
                    await this._room.notifyRoomKey(roomKey);
                }
            } else if (session?.algorithm) {
                console.info(`Backed-up session of unknown algorithm: ${session.algorithm}`);
            }
        } catch (err) {
            console.error(`Could not get session ${sessionId} from backup`, err);
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
    getEventIdsForRoomKey(roomKey) {
        // TODO: we could concat both results here, and only put stuff in
        // candidates if it is not in missing sessions to use a bit less memory
        let eventIds = this._missingSessions.getEventIds(roomKey.senderKey, roomKey.sessionId);
        if (!eventIds) {
            eventIds = this._missingSessionCandidates.getEventIds(roomKey.senderKey, roomKey.sessionId);
        }
        return eventIds;
    }

    /**
     * caches mapping of session to event id of all encrypted candidates
     * and filters to return only the candidates for the given room key
     */
    findAndCacheEntriesForRoomKey(roomKey, candidateEntries) {
        const matches = [];

        for (const entry of candidateEntries) {
            if (entry.eventType === ENCRYPTED_TYPE) {
                this._missingSessionCandidates.addEvent(entry.event);
                const senderKey = entry.event?.content?.["sender_key"];
                const sessionId = entry.event?.content?.["session_id"];
                if (senderKey === roomKey.senderKey && sessionId === roomKey.sessionId) {
                    matches.push(entry);
                }
            }
        }
        
        return matches;
    }

    /** shares the encryption key for the next message if needed */
    async ensureMessageKeyIsShared(hsApi, log) {
        if (this._lastKeyPreShareTime?.measure() < MIN_PRESHARE_INTERVAL) {
            return;
        }
        this._lastKeyPreShareTime = this._clock.createMeasure();
        const roomKeyMessage = await this._megolmEncryption.ensureOutboundSession(this._room.id, this._encryptionParams);
        if (roomKeyMessage) {
            await log.wrap("share key", log => this._shareNewRoomKey(roomKeyMessage, hsApi, log));
        }
    }

    async encrypt(type, content, hsApi, log) {
        const megolmResult = await log.wrap("megolm encrypt", () => this._megolmEncryption.encrypt(this._room.id, type, content, this._encryptionParams));
        if (megolmResult.roomKeyMessage) {
            log.wrapDetached("share key", log => this._shareNewRoomKey(megolmResult.roomKeyMessage, hsApi, log));
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

    async _shareNewRoomKey(roomKeyMessage, hsApi, log) {
        await this._deviceTracker.trackRoom(this._room, log);
        const devices = await this._deviceTracker.devicesForTrackedRoom(this._room.id, hsApi, log);
        const userIds = Array.from(devices.reduce((set, device) => set.add(device.userId), new Set()));

        // store operation for room key share, in case we don't finish here
        const writeOpTxn = this._storage.readWriteTxn([this._storage.storeNames.operations]);
        let operationId;
        try {
            operationId = this._writeRoomKeyShareOperation(roomKeyMessage, userIds, writeOpTxn);
        } catch (err) {
            writeOpTxn.abort();
            throw err;
        }
        log.set("id", operationId);
        log.set("sessionId", roomKeyMessage.session_id);
        await writeOpTxn.complete();
        // TODO: at this point we have the room key stored, and the rest is sort of optional
        // it would be nice if we could signal SendQueue that any error from here on is non-fatal and
        // return the encrypted payload.

        // send the room key
        await this._sendRoomKey(roomKeyMessage, devices, hsApi, log);

        // remove the operation
        const removeOpTxn = this._storage.readWriteTxn([this._storage.storeNames.operations]);
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

    async flushPendingRoomKeyShares(hsApi, operations, log) {
        // this has to be reentrant as it can be called from Room.start while still running
        if (this._isFlushingRoomKeyShares) {
            return;
        }
        this._isFlushingRoomKeyShares = true;
        try {
            if (!operations) {
                const txn = this._storage.readTxn([this._storage.storeNames.operations]);
                operations = await txn.operations.getAllByTypeAndScope("share_room_key", this._room.id);
            }
            for (const operation of operations) {
                // just to be sure
                if (operation.type !== "share_room_key") {
                    continue;
                }
                await log.wrap("operation", async log => {
                    log.set("id", operation.id);
                    const devices = await this._deviceTracker.devicesForRoomMembers(this._room.id, operation.userIds, hsApi, log);
                    await this._sendRoomKey(operation.roomKeyMessage, devices, hsApi, log);
                    const removeTxn = this._storage.readWriteTxn([this._storage.storeNames.operations]);
                    try {
                        removeTxn.operations.remove(operation.id);
                    } catch (err) {
                        removeTxn.abort();
                        throw err;
                    }
                    await removeTxn.complete();
                });
            }
        } finally {
            this._isFlushingRoomKeyShares = false;
        }
    }

    async _sendRoomKey(roomKeyMessage, devices, hsApi, log) {
        const messages = await log.wrap("olm encrypt", log => this._olmEncryption.encrypt(
            "m.room_key", roomKeyMessage, devices, hsApi, log));
        await log.wrap("send", log => this._sendMessagesToDevices(ENCRYPTED_TYPE, messages, hsApi, log));
    }

    async _sendMessagesToDevices(type, messages, hsApi, log) {
        log.set("messages", messages.length);
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
        await hsApi.sendToDevice(type, payload, txnId, {log}).response();
    }

    dispose() {
        this._disposed = true;
        this._megolmBackfillCache.dispose();
        this._megolmSyncCache.dispose();
    }
}

/**
 * wrappers around megolm decryption classes to be able to post-process
 * the decryption results before turning them
 */
class DecryptionPreparation {
    constructor(megolmDecryptionPreparation, extraErrors, flags, roomEncryption, events) {
        this._megolmDecryptionPreparation = megolmDecryptionPreparation;
        this._extraErrors = extraErrors;
        this._flags = flags;
        this._roomEncryption = roomEncryption;
        this._events = events;
    }

    async decrypt() {
        return new DecryptionChanges(
            await this._megolmDecryptionPreparation.decrypt(),
            this._extraErrors,
            this._flags,
            this._roomEncryption,
            this._events);
    }

    dispose() {
        this._megolmDecryptionPreparation.dispose();
    }
}

class DecryptionChanges {
    constructor(megolmDecryptionChanges, extraErrors, flags, roomEncryption, events) {
        this._megolmDecryptionChanges = megolmDecryptionChanges;
        this._extraErrors = extraErrors;
        this._flags = flags;
        this._roomEncryption = roomEncryption;
        this._events = events;
    }

    async write(txn) {
        const {results, errors} = await this._megolmDecryptionChanges.write(txn);
        mergeMap(this._extraErrors, errors);
        await this._roomEncryption._processDecryptionResults(this._events, results, errors, this._flags, txn);
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

class SessionToEventIdsMap {
    constructor() {
        this._eventIdsBySession = new Map();
    }

    addEvent(event) {
        let isNewSession = false;
        const senderKey = event.content?.["sender_key"];
        const sessionId = event.content?.["session_id"];
        const key = encodeMissingSessionKey(senderKey, sessionId);
        let eventIds = this._eventIdsBySession.get(key);
        // new missing session
        if (!eventIds) {
            eventIds = new Set();
            this._eventIdsBySession.set(key, eventIds);
            isNewSession = true;
        }
        eventIds.add(event.event_id);
        return isNewSession;
    }

    getEventIds(senderKey, sessionId) {
        const key = encodeMissingSessionKey(senderKey, sessionId);
        const entriesForSession = this._eventIdsBySession.get(key);
        if (entriesForSession) {
            return [...entriesForSession];
        }
    }

    getSessions() {
        return Array.from(this._eventIdsBySession.keys()).map(decodeMissingSessionKey);
    }

    hasSession(senderKey, sessionId) {
        return this._eventIdsBySession.has(encodeMissingSessionKey(senderKey, sessionId));
    }

    removeEvent(event) {
        let hasRemovedSession = false;
        const senderKey = event.content?.["sender_key"];
        const sessionId = event.content?.["session_id"];
        const key = encodeMissingSessionKey(senderKey, sessionId);
        let eventIds = this._eventIdsBySession.get(key);
        if (eventIds) {
            if (eventIds.delete(event.event_id)) {
                if (!eventIds.length) {
                    this._eventIdsBySession.delete(key);
                    hasRemovedSession = true;
                }
            }
        }
        return hasRemovedSession;
    }
}
