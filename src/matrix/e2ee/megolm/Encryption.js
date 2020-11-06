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

import {MEGOLM_ALGORITHM} from "../common.js";

export class Encryption {
    constructor({pickleKey, olm, account, now, ownDeviceId}) {
        this._pickleKey = pickleKey;
        this._olm = olm;
        this._account = account;
        this._now = now;
        this._ownDeviceId = ownDeviceId;
    }

    async openRoomEncryption(roomId, encryptionParams, txn) {
        const sessionEntry = await txn.outboundGroupSessions.get(roomId);
        let session = null;
        if (sessionEntry) {
            session = new this._olm.OutboundGroupSession();
            session.unpickle(this._pickleKey, sessionEntry.session);
        }
        return new RoomEncryption({
            pickleKey: this._pickleKey,
            olm: this._olm,
            account: this._account,
            now: this._now,
            ownDeviceId: this._ownDeviceId,
            sessionEntry,
            session,
            roomId,
            encryptionParams
        });
    }
}

export class RoomEncryption {
    constructor({pickleKey, olm, account, now, roomId, encryptionParams, sessionEntry, session, ownDeviceId}) {
        this._pickleKey = pickleKey;
        this._olm = olm;
        this._account = account;
        this._now = now;
        this._roomId = roomId;
        this._encryptionParams = encryptionParams;
        this._ownDeviceId = ownDeviceId;
        this._sessionEntry = sessionEntry;
        this._session = session;
    }

    /**
     * Discards the outbound session, if any.
     * @param  {Transaction} txn         a storage transaction with readwrite access to outboundGroupSessions and inboundGroupSessions stores
     */
    discardOutboundSession(txn) {
        txn.outboundGroupSessions.remove(this._roomId);
        if (this._session) {
            this._session.free();
        }
        this._session = null;
        this._sessionEntry = null;
    }

    /**
     * Creates an outbound session if non exists already
     * @param  {Transaction} txn         a storage transaction with readwrite access to outboundGroupSessions and inboundGroupSessions stores
     * @return {boolean} true if a session has been created. Call `createRoomKeyMessage` to share the new session.
     */
    ensureOutboundSession(txn) {
        if (this._readOrCreateSession(txn)) {
            this._writeSession(txn);
            return true;
        }
        return false;
    }

    /**
     * Encrypts a message with megolm
     * @param  {string} type             event type to encrypt
     * @param  {string} content          content to encrypt
     * @param  {Transaction} txn         a storage transaction with readwrite access to outboundGroupSessions and inboundGroupSessions stores
     * @return {Promise<EncryptionResult>}
     */
    encrypt(type, content, txn) {
        let roomKeyMessage;
        if (this._readOrCreateSession(txn)) {
            // important to create the room key message before encrypting
            // so the message index isn't advanced yet
            roomKeyMessage = this.createRoomKeyMessage();
        }
        const encryptedContent = this._encryptContent(type, content);
        this._writeSession(txn);
        return new EncryptionResult(encryptedContent, roomKeyMessage);
    }

    needsNewSession() {
        if (!this._session) {
            return true;
        }
        let rotationPeriodMs = 604800000; // default
        if (Number.isSafeInteger(this._encryptionParams?.rotation_period_ms)) {
            rotationPeriodMs = this._encryptionParams?.rotation_period_ms;
        }
        let rotationPeriodMsgs = 100; // default
        if (Number.isSafeInteger(this._encryptionParams?.rotation_period_msgs)) {
            rotationPeriodMsgs = this._encryptionParams?.rotation_period_msgs;
        }
        // assume this is a new session if sessionEntry hasn't been created/written yet
        if (this._sessionEntry && this._now() > (this._sessionEntry.createdAt + rotationPeriodMs)) {
            return true;
        }
        if (this._session.message_index() >= rotationPeriodMsgs) {
            return true;
        }
        return false;
    }

    createRoomKeyMessage() {
        if (!this._session) {
            return;
        }
        return {
            room_id: this._roomId,
            session_id: this._session.session_id(),
            session_key: this._session.session_key(),
            algorithm: MEGOLM_ALGORITHM,
            // chain_index is ignored by element-web if not all clients
            // but let's send it anyway, as element-web does so
            chain_index: this._session.message_index()
        }
    }

    dispose() {
        if (this._session) {
            this._session.free();
        }
    }

    _encryptContent(type, content) {
        const plaintext = JSON.stringify({
            room_id: this._roomId,
            type,
            content
        });
        const ciphertext = this._session.encrypt(plaintext);

        const encryptedContent = {
            algorithm: MEGOLM_ALGORITHM,
            sender_key: this._account.identityKeys.curve25519,
            ciphertext,
            session_id: this._session.session_id(),
            device_id: this._ownDeviceId
        };

        return encryptedContent;
    }


    _readOrCreateSession(txn) {
        if (this.needsNewSession()) {
            if (this._session) {
                this._session.free();
                this._session = new this._olm.OutboundGroupSession();
            }
            this._session.create();
            this._storeAsInboundSession(txn);
            return true;
        }
        return false;
    }

    _writeSession(txn) {
        this._sessionEntry = {
            roomId: this._roomId,
            session: this._session.pickle(this._pickleKey),
            createdAt: this._sessionEntry?.createdAt || this._now(),
        };
        txn.outboundGroupSessions.set(this._sessionEntry);
    }

    _storeAsInboundSession(txn) {
        const {identityKeys} = this._account;
        const claimedKeys = {ed25519: identityKeys.ed25519};
        const session = new this._olm.InboundGroupSession();
        try {
            session.create(this._session.session_key());
            const sessionEntry = {
                roomId: this._roomId,
                senderKey: identityKeys.curve25519,
                sessionId: session.session_id(),
                session: session.pickle(this._pickleKey),
                claimedKeys,
            };
            txn.inboundGroupSessions.set(sessionEntry);
            return sessionEntry;
        } finally {
            session.free();
        }
    }
}
/**
 * @property {object?} roomKeyMessage  if encrypting this message
 *                                     created a new outbound session,
 *                                     this contains the content of the m.room_key message
 *                                     that should be sent out over olm.
 * @property {object} content  the encrypted message as the content of
 *                             the m.room.encrypted event that should be sent out   
 */
class EncryptionResult {
    constructor(content, roomKeyMessage) {
        this.content = content;
        this.roomKeyMessage = roomKeyMessage;
    }
}
