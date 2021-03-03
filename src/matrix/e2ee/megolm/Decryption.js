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

import {DecryptionError} from "../common.js";
import * as RoomKey from "./decryption/RoomKey.js";
import {SessionInfo} from "./decryption/SessionInfo.js";
import {DecryptionPreparation} from "./decryption/DecryptionPreparation.js";
import {SessionDecryption} from "./decryption/SessionDecryption.js";
import {SessionCache} from "./decryption/SessionCache.js";
import {MEGOLM_ALGORITHM} from "../common.js";
import {validateEvent, groupEventsBySession} from "./decryption/utils.js";

export class Decryption {
    constructor({pickleKey, olm, olmWorker}) {
        this._pickleKey = pickleKey;
        this._olm = olm;
        this._olmWorker = olmWorker;
    }

    createSessionCache(size) {
        return new SessionCache(size);
    }

    async addMissingKeyEventIds(roomId, senderKey, sessionId, eventIds, txn) {
        let sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
        // we never want to overwrite an existing key
        if (sessionEntry?.session) {
            return;
        }
        if (sessionEntry) {
            const uniqueEventIds = new Set(sessionEntry.eventIds);
            for (const id of eventIds) {
                uniqueEventIds.add(id);
            }
            sessionEntry.eventIds = Array.from(uniqueEventIds);
        } else {
            sessionEntry = {roomId, senderKey, sessionId, eventIds};
        }
        txn.inboundGroupSessions.set(sessionEntry);
    }

    async getEventIdsForMissingKey(roomId, senderKey, sessionId, txn) {
        const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
        if (sessionEntry && !sessionEntry.session) {
            return sessionEntry.eventIds;
        }
    }

    async hasSession(roomId, senderKey, sessionId, txn) {
        const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
        const isValidSession = typeof sessionEntry?.session === "string";
        return isValidSession;
    }

    /**
     * Reads all the state from storage to be able to decrypt the given events.
     * Decryption can then happen outside of a storage transaction.
     * @param  {[type]} roomId       [description]
     * @param  {[type]} events       [description]
     * @param  {RoomKey[]?} newKeys  keys as returned from extractRoomKeys, but not yet committed to storage. May be undefined.
     * @param  {[type]} sessionCache [description]
     * @param  {[type]} txn          [description]
     * @return {DecryptionPreparation}
     */
    async prepareDecryptAll(roomId, events, newKeys, sessionCache, txn) {
        const errors = new Map();
        const validEvents = [];

        for (const event of events) {
            if (validateEvent(event)) {
                validEvents.push(event);
            } else {
                errors.set(event.event_id, new DecryptionError("MEGOLM_INVALID_EVENT", event))
            }
        }

        const eventsBySession = groupEventsBySession(validEvents);

        const sessionDecryptions = [];
        await Promise.all(Array.from(eventsBySession.values()).map(async group => {
            const sessionInfo = await this._getSessionInfo(roomId, group.senderKey, group.sessionId, newKeys, sessionCache, txn);
            if (sessionInfo) {
                sessionDecryptions.push(new SessionDecryption(sessionInfo, group.events, this._olmWorker));
            } else {
                for (const event of group.events) {
                    errors.set(event.event_id, new DecryptionError("MEGOLM_NO_SESSION", event));
                }
            }
        }));

        return new DecryptionPreparation(roomId, sessionDecryptions, errors);
    }

    async _getSessionInfo(roomId, senderKey, sessionId, newKeys, sessionCache, txn) {
        let sessionInfo;
        if (newKeys) {
            const key = newKeys.find(k => k.roomId === roomId && k.senderKey === senderKey && k.sessionId === sessionId);
            if (key) {
                sessionInfo = await key.createSessionInfo(this._olm, this._pickleKey, txn);
                if (sessionInfo) {
                    sessionCache.add(sessionInfo);
                }
            }
        }
        // look only in the cache after looking into newKeys as it may contains that are better
        if (!sessionInfo) {
            sessionInfo = sessionCache.get(roomId, senderKey, sessionId);
        }
        if (!sessionInfo) {
            const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
            if (sessionEntry && sessionEntry.session) {
                let session = new this._olm.InboundGroupSession();
                try {
                    session.unpickle(this._pickleKey, sessionEntry.session);
                    sessionInfo = new SessionInfo(roomId, senderKey, session, sessionEntry.claimedKeys);
                } catch (err) {
                    session.free();
                    throw err;
                }
                sessionCache.add(sessionInfo);
            }
        }
        return sessionInfo;
    }

    /**
     * Writes the key as an inbound group session if there is not already a better key in the store
     * @param  {RoomKey}          key
     * @param {Transaction} txn   a storage transaction with read/write on inboundGroupSessions
     * @return {Promise<boolean>} whether the key was the best for the sessio id and was written
     */
    writeRoomKey(key, txn) {
        return key.write(this._olm, this._pickleKey, txn);
    }

    /**
     * Extracts room keys from decrypted device messages.
     * The key won't be persisted yet, you need to call RoomKey.write for that.
     * 
     * @param {Array<OlmDecryptionResult>} decryptionResults, any non megolm m.room_key messages will be ignored.
     * @return {Array<RoomKey>} an array with validated RoomKey's. Note that it is possible we already have a better version of this key in storage though; writing the key will tell you so.
     */
    roomKeysFromDeviceMessages(decryptionResults, log) {
        let keys = [];
        for (const dr of decryptionResults) {
            if (dr.event?.type !== "m.room_key" || dr.event.content?.algorithm !== MEGOLM_ALGORITHM) {
                continue;
            }
            log.wrap("room_key", log => {
                const key = RoomKey.fromDeviceMessage(dr);
                if (key) {
                    log.set("roomId", key.roomId);
                    log.set("id", key.sessionId);
                    keys.push(key);
                } else {
                    log.logLevel = log.level.Warn;
                    log.set("invalid", true);
                }
            }, log.level.Detail);
        }
        return keys;
    }

    roomKeyFromBackup(roomId, sessionId, sessionInfo) {
        return RoomKey.fromBackup(roomId, sessionId, sessionInfo);
    }
}

