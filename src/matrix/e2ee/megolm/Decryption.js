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

const CACHE_MAX_SIZE = 10;

export class Decryption {
    constructor({pickleKey, olm}) {
        this._pickleKey = pickleKey;
        this._olm = olm;
    }

    createSessionCache() {
        return new SessionCache();
    }

    async decrypt(roomId, event, sessionCache, txn) {
        const senderKey = event.content?.["sender_key"];
        const sessionId = event.content?.["session_id"];
        const ciphertext = event.content?.ciphertext;

        if (
            typeof senderKey !== "string" ||
            typeof sessionId !== "string" ||
            typeof ciphertext !== "string"
        ) {
            throw new DecryptionError("MEGOLM_INVALID_EVENT", event);
        }

        let session = sessionCache.get(roomId, senderKey, sessionId);
        if (!session) {
            const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
            if (sessionEntry) {
                session = new this._olm.InboundGroupSession();
                try {
                    session.unpickle(this._pickleKey, sessionEntry.session);
                } catch (err) {
                    session.free();
                    throw err;
                }
                sessionCache.add(roomId, senderKey, session);
            }
        }
        if (!session) {
            return;
        }
        const {plaintext, message_index: messageIndex} = session.decrypt(ciphertext);
        let payload;
        try {
            payload = JSON.parse(plaintext);
        } catch (err) {
            throw new DecryptionError("PLAINTEXT_NOT_JSON", event, {plaintext, err});
        }
        if (payload.room_id !== roomId) {
            throw new DecryptionError("MEGOLM_WRONG_ROOM", event,
                {encryptedRoomId: payload.room_id, eventRoomId: roomId});
        }
        await this._handleReplayAttack(roomId, sessionId, messageIndex, event, txn);
        // TODO: verify event came from said senderKey
        return payload;
    }

    async _handleReplayAttack(roomId, sessionId, messageIndex, event, txn) {
        const eventId = event.event_id;
        const timestamp = event.origin_server_ts;
        const decryption = await txn.groupSessionDecryptions.get(roomId, sessionId, messageIndex);
        if (decryption && decryption.eventId !== eventId) {
            // the one with the newest timestamp should be the attack
            const decryptedEventIsBad = decryption.timestamp < timestamp;
            const badEventId = decryptedEventIsBad ? eventId : decryption.eventId;
            throw new DecryptionError("MEGOLM_REPLAYED_INDEX", event, {badEventId, otherEventId: decryption.eventId});
        }
        if (!decryption) {
            txn.groupSessionDecryptions.set({
                roomId,
                sessionId,
                messageIndex,
                eventId,
                timestamp
            });
        }
    }

    async addRoomKeys(payloads, txn) {
        const newSessions = [];
        for (const {senderKey, event} of payloads) {
            const roomId = event.content?.["room_id"];
            const sessionId = event.content?.["session_id"];
            const sessionKey = event.content?.["session_key"];

            if (
                typeof roomId !== "string" || 
                typeof sessionId !== "string" || 
                typeof senderKey !== "string" ||
                typeof sessionKey !== "string"
            ) {
                return;
            }

            // TODO: compare first_known_index to see which session to keep
            const hasSession = await txn.inboundGroupSessions.has(roomId, senderKey, sessionId);
            if (!hasSession) {
                const session = new this._olm.InboundGroupSession();
                try {
                    session.create(sessionKey);
                    const sessionEntry = {
                        roomId,
                        senderKey,
                        sessionId,
                        session: session.pickle(this._pickleKey),
                        claimedKeys: event.keys,
                    };
                    txn.inboundGroupSessions.set(sessionEntry);
                    newSessions.push(sessionEntry);
                } finally {
                    session.free();
                }
            }

        }
        // this will be passed to the Room in notifyRoomKeys
        return newSessions;
    }
}

class SessionCache {
    constructor() {
        this._sessions = [];
    }

    get(roomId, senderKey, sessionId) {
        const idx = this._sessions.findIndex(s => {
            return s.roomId === roomId &&
                s.senderKey === senderKey &&
                sessionId === s.session.session_id();
        });
        if (idx !== -1) {
            const entry = this._sessions[idx];
            // move to top
            if (idx > 0) {
                this._sessions.splice(idx, 1);
                this._sessions.unshift(entry);
            }
            return entry.session;
        }
    }

    add(roomId, senderKey, session) {
        // add new at top
        this._sessions.unshift({roomId, senderKey, session});
        if (this._sessions.length > CACHE_MAX_SIZE) {
            // free sessions we're about to remove
            for (let i = CACHE_MAX_SIZE; i < this._sessions.length; i += 1) {
                this._sessions[i].session.free();
            }
            this._sessions = this._sessions.slice(0, CACHE_MAX_SIZE);
        }
    }

    dispose() {
        for (const entry of this._sessions) {
            entry.session.free();
        }

    }
}
