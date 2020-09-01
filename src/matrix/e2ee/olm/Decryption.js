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

const SESSION_LIMIT_PER_SENDER_KEY = 4;

function isPreKeyMessage(message) {
    return message.type === 0;
}

export class Decryption {
    constructor({account, pickleKey, now, ownUserId, storage, olm}) {
        this._account = account;
        this._pickleKey = pickleKey;
        this._now = now;
        this._ownUserId = ownUserId;
        this._storage = storage;
        this._olm = olm;
        this._createOutboundSessionPromise = null;
    }

    // we can't run this in the sync txn because decryption will be async ...
    // should we store the encrypted events in the sync loop and then pop them from there?
    // it would be good in any case to run the (next) sync request in parallel with decryption
    async decrypt(event) {
        const senderKey = event.content?.["sender_key"];
        const ciphertext = event.content?.ciphertext;
        if (!ciphertext) {
            throw new DecryptionError("OLM_MISSING_CIPHERTEXT");
        }
        const message = ciphertext?.[this._account.identityKeys.curve25519];
        if (!message) {
            // TODO: use same error messages as element-web
            throw new DecryptionError("OLM_NOT_INCLUDED_IN_RECIPIENTS");
        }
        const sortedSessionIds = await this._getSortedSessionIds(senderKey);
        let plaintext;
        for (const sessionId of sortedSessionIds) {
            try {
                plaintext = await this._attemptDecryption(senderKey, sessionId, message);
            } catch (err) {
                throw new DecryptionError("OLM_BAD_ENCRYPTED_MESSAGE", {senderKey, error: err.message});
            }
            if (typeof plaintext === "string") {
                break;
            }
        }
        if (typeof plaintext !== "string" && isPreKeyMessage(message)) {
            plaintext = await this._createOutboundSessionAndDecrypt(senderKey, message, sortedSessionIds);
        }
        if (typeof plaintext === "string") {
            return this._parseAndValidatePayload(plaintext, event);
        }
    }

    async _getSortedSessionIds(senderKey) {
        const readTxn = await this._storage.readTxn([this._storage.storeNames.olmSessions]);
        const sortedSessions = await readTxn.olmSessions.getAll(senderKey);
        // sort most recent used sessions first
        sortedSessions.sort((a, b) => {
            return b.lastUsed - a.lastUsed;
        });
        return sortedSessions.map(s => s.sessionId);
    }

    async _createOutboundSessionAndDecrypt(senderKey, message, sortedSessionIds) {
        // serialize calls so the account isn't written from multiple
        // sessions at once
        while (this._createOutboundSessionPromise) {
            await this._createOutboundSessionPromise;
        }
        this._createOutboundSessionPromise = (async () => {
            try {
                return await this._createOutboundSessionAndDecryptImpl(senderKey, message, sortedSessionIds);
            } finally {
                this._createOutboundSessionPromise = null;
            }
        })();
        return await this._createOutboundSessionPromise;
    }

    // this could internally dispatch to a web-worker
    async _createOutboundSessionAndDecryptImpl(senderKey, message, sortedSessionIds) {
        let plaintext;
        const session = this._account.createInboundOlmSession(senderKey, message.body);
        try {
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.session,
                this._storage.storeNames.olmSessions,
            ]);
            try {
                // do this before removing the OTK removal, so we know decryption succeeded beforehand,
                // as we don't have a way of undoing the OTK removal atm.
                plaintext = session.decrypt(message.type, message.body);
                this._account.writeRemoveOneTimeKey(session, txn);
                // remove oldest session if we reach the limit including the new session
                if (sortedSessionIds.length >= SESSION_LIMIT_PER_SENDER_KEY) {
                    // given they are sorted, the oldest one is the last one
                    const oldestSessionId = sortedSessionIds[sortedSessionIds.length - 1];
                    txn.olmSessions.remove(senderKey, oldestSessionId);
                }
                txn.olmSessions.set({
                    session: session.pickle(this._pickleKey),
                    sessionId: session.session_id(),
                    senderKey,
                    lastUsed: this._now(),
                });
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
        } finally {
            session.free();
        }
        return plaintext;
    }

    // this could internally dispatch to a web-worker
    async _attemptDecryption(senderKey, sessionId, message) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.olmSessions]);
        const session = new this._olm.Session();
        let plaintext;
        try {
            const sessionEntry = await txn.olmSessions.get(senderKey, sessionId);
            session.unpickle(this._pickleKey, sessionEntry.session);
            if (isPreKeyMessage(message) && !session.matches_inbound(message.body)) {
                return;
            }
            try {
                plaintext = session.decrypt(message.type, message.body);
            } catch (err) {
                if (isPreKeyMessage(message)) {
                    throw new Error(`Error decrypting prekey message with existing session id ${sessionId}: ${err.message}`);
                }
                // decryption failed, bail out
                return;
            }
            sessionEntry.session = session.pickle(this._pickleKey);
            sessionEntry.lastUsed = this._now();
            txn.olmSessions.set(sessionEntry);
        } catch(err) {
            txn.abort();
            throw err;
        } finally {
            session.free();
        }
        await txn.complete();
        return plaintext;
    }

    _parseAndValidatePayload(plaintext, event) {
        const payload = JSON.parse(plaintext);

        if (payload.sender !== event.sender) {
            throw new DecryptionError("OLM_FORWARDED_MESSAGE", {sentBy: event.sender, encryptedBy: payload.sender});
        }
        if (payload.recipient !== this._ownUserId) {
            throw new DecryptionError("OLM_BAD_RECIPIENT", {recipient: payload.recipient});
        }
        if (payload.recipient_keys?.ed25519 !== this._account.identityKeys.ed25519) {
            throw new DecryptionError("OLM_BAD_RECIPIENT_KEY", {key: payload.recipient_keys?.ed25519});
        }
        // TODO: check room_id
        if (!payload.type) {
            throw new Error("missing type on payload");
        }
        if (!payload.content) {
            throw new Error("missing content on payload");
        }
        return payload;
    }
}
