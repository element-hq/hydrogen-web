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
import {groupBy} from "../../../utils/groupBy.js";

import {SessionInfo} from "./decryption/SessionInfo.js";
import {DecryptionPreparation} from "./decryption/DecryptionPreparation.js";
import {SessionDecryption} from "./decryption/SessionDecryption.js";
import {SessionCache} from "./decryption/SessionCache.js";
import {DecryptionWorker, WorkerPool} from "./decryption/DecryptionWorker.js";

function getSenderKey(event) {
    return event.content?.["sender_key"];
}

function getSessionId(event) {
    return event.content?.["session_id"];
}

function getCiphertext(event) {
    return event.content?.ciphertext;
}

export class Decryption {
    constructor({pickleKey, olm}) {
        this._pickleKey = pickleKey;
        this._olm = olm;
        // this._decryptor = new DecryptionWorker(new Worker("./src/worker.js"));
        this._decryptor = new DecryptionWorker(new WorkerPool("worker-1039452087.js", 4));
        this._initPromise = this._decryptor.init();
    }

    createSessionCache(fallback) {
        return new SessionCache(fallback);
    }

    /**
     * Reads all the state from storage to be able to decrypt the given events.
     * Decryption can then happen outside of a storage transaction.
     * @param  {[type]} roomId       [description]
     * @param  {[type]} events        [description]
     * @param  {[type]} sessionCache [description]
     * @param  {[type]} txn          [description]
     * @return {DecryptionPreparation}
     */
    async prepareDecryptAll(roomId, events, sessionCache, txn) {
        await this._initPromise;
        const errors = new Map();
        const validEvents = [];

        for (const event of events) {
            const isValid = typeof getSenderKey(event) === "string" &&
                            typeof getSessionId(event) === "string" &&
                            typeof getCiphertext(event) === "string";
            if (isValid) {
                validEvents.push(event);
            } else {
                errors.set(event.event_id, new DecryptionError("MEGOLM_INVALID_EVENT", event))
            }
        }

        const eventsBySession = groupBy(validEvents, event => {
            return `${getSenderKey(event)}|${getSessionId(event)}`;
        });

        const sessionDecryptions = [];

        await Promise.all(Array.from(eventsBySession.values()).map(async eventsForSession => {
            const first = eventsForSession[0];
            const senderKey = getSenderKey(first);
            const sessionId = getSessionId(first);
            const sessionInfo = await this._getSessionInfo(roomId, senderKey, sessionId, sessionCache, txn);
            if (!sessionInfo) {
                for (const event of eventsForSession) {
                    errors.set(event.event_id, new DecryptionError("MEGOLM_NO_SESSION", event));
                }
            } else {
                sessionDecryptions.push(new SessionDecryption(sessionInfo, eventsForSession, this._decryptor));
            }
        }));

        return new DecryptionPreparation(roomId, sessionDecryptions, errors);
    }

    async _getSessionInfo(roomId, senderKey, sessionId, sessionCache, txn) {
        let sessionInfo;
        sessionInfo = sessionCache.get(roomId, senderKey, sessionId);
        if (!sessionInfo) {
            const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
            if (sessionEntry) {
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
     * @type {MegolmInboundSessionDescription}
     * @property {string} senderKey the sender key of the session
     * @property {string} sessionId the session identifier
     * 
     * Adds room keys as inbound group sessions
     * @param {Array<OlmDecryptionResult>} decryptionResults an array of m.room_key decryption results.
     * @param {[type]} txn      a storage transaction with read/write on inboundGroupSessions
     * @return {Promise<Array<MegolmInboundSessionDescription>>} an array with the newly added sessions
     */
    async addRoomKeys(decryptionResults, txn) {
        const newSessions = [];
        for (const {senderCurve25519Key: senderKey, event, claimedEd25519Key} of decryptionResults) {
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
                        claimedKeys: {ed25519: claimedEd25519Key},
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

