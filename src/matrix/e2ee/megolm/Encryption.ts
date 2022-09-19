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

import {MEGOLM_ALGORITHM} from "../common";
import {OutboundRoomKey} from "./decryption/RoomKey";
import type {Account} from "../Account";
import type {KeyLoader} from "./decryption/KeyLoader";
import type {Olm} from "../olm/Session";
import type {Transaction} from "../../storage/idb/Transaction.js";
import type {RoomKeyMessage} from "../../storage/idb/stores/OperationStore";
import type {OutboundGroupSession} from "@matrix-org/olm";
import type {Content} from "../../storage/types";

type Config = {
    pickleKey: string;
    olm: Olm;
    account: Account;
    keyLoader: KeyLoader;
    storage: Storage;
    now: () => number;
    ownDeviceId: string;
};

export class Encryption {
    private _pickleKey: string;
    private _olm: Olm;
    private _account: Account;
    private _keyLoader: KeyLoader;
    private _storage: Storage;
    private _now: () => number;
    private _ownDeviceId: string;

    constructor({pickleKey, olm, account, keyLoader, storage, now, ownDeviceId}: Config) {
        this._pickleKey = pickleKey;
        this._olm = olm;
        this._account = account;
        this._keyLoader = keyLoader;
        this._storage = storage;
        this._now = now;
        this._ownDeviceId = ownDeviceId;
    }

    discardOutboundSession(roomId: string, txn: Transaction): void {
        txn.outboundGroupSessions.remove(roomId);
    }

    async createRoomKeyMessage(roomId: string, txn: Transaction): Promise<RoomKeyMessage | undefined> {
        let sessionEntry = await txn.outboundGroupSessions.get(roomId);
        if (sessionEntry) {
            const session = new this._olm.OutboundGroupSession();
            try {
                session.unpickle(this._pickleKey, sessionEntry.session);
                return this._createRoomKeyMessage(session, roomId);
            } finally {
                session.free();
            }
        }
    }

    createWithheldMessage(roomMessage: RoomKeyMessage, code: string, reason: string): WithheldMessage {
        return {
            algorithm: roomMessage.algorithm,
            code,
            reason,
            room_id: roomMessage.room_id,
            sender_key: this._account.identityKeys.curve25519,
            session_id: roomMessage.session_id
        };
    }

    async ensureOutboundSession(roomId: string, encryptionParams: Content): Promise<RoomKeyMessage | undefined> {
        let session = new this._olm.OutboundGroupSession();
        try {
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.inboundGroupSessions,
                this._storage.storeNames.outboundGroupSessions,
            ]);
            let roomKeyMessage: RoomKeyMessage | undefined;
            try {
                let sessionEntry = await txn.outboundGroupSessions.get(roomId);
                roomKeyMessage = await this._readOrCreateSession(session, sessionEntry, roomId, encryptionParams, txn);
                if (roomKeyMessage) {
                    this._writeSession(this._now(), session, roomId, txn);
                }
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
            return roomKeyMessage;
        } finally {
            session.free();
        }
    }

    async _readOrCreateSession(
        session: OutboundGroupSession,
        sessionEntry: { session: any; createdAt: any },
        roomId: string,
        encryptionParams: Content,
        txn: Transaction
    ): Promise<RoomKeyMessage | undefined> {
        if (sessionEntry) {
            session.unpickle(this._pickleKey, sessionEntry.session);
        }
        if (!sessionEntry || this._needsToRotate(session, sessionEntry.createdAt, encryptionParams)) {
            // in the case of rotating, recreate a session as we already unpickled into it
            if (sessionEntry) {
                session.free();
                session = new this._olm.OutboundGroupSession();
            }
            session.create();
            const roomKeyMessage = this._createRoomKeyMessage(session, roomId);
            const roomKey = new OutboundRoomKey(roomId, session, this._account.identityKeys);
            await roomKey.write(this._keyLoader, txn);
            return roomKeyMessage;
        }
    }

    _writeSession(createdAt: number, session: OutboundGroupSession, roomId: string, txn: Transaction): void {
        txn.outboundGroupSessions.set({
            roomId,
            session: session.pickle(this._pickleKey),
            createdAt,
        });
    }

    /**
     * Encrypts a message with megolm
     * @param  {string} type             event type to encrypt
     * @param  {string} content          content to encrypt
     * @param  {Content} encryptionParams the content of the m.room.encryption event
     */
     async encrypt(
        roomId: string,
        type: string,
        content: string,
        encryptionParams: Content
    ): Promise<EncryptionResult> {
        let session = new this._olm.OutboundGroupSession();
        try {
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.inboundGroupSessions,
                this._storage.storeNames.outboundGroupSessions,
            ]);
            let roomKeyMessage;
            let encryptedContent;
            try {
                let sessionEntry = await txn.outboundGroupSessions.get(roomId);
                roomKeyMessage = await this._readOrCreateSession(session, sessionEntry, roomId, encryptionParams, txn);
                encryptedContent = this._encryptContent(roomId, session, type, content);
                // update timestamp when a new session is created
                const createdAt = roomKeyMessage ? this._now() : sessionEntry.createdAt;
                this._writeSession(createdAt, session, roomId, txn);

            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
            return new EncryptionResult(encryptedContent, roomKeyMessage);
        } finally {
            if (session) {
                session.free();
            }
        }
    }

    _needsToRotate(session: OutboundGroupSession, createdAt: number, encryptionParams: Content): true | undefined {
        let rotationPeriodMs = 604800000; // default
        if (Number.isSafeInteger(encryptionParams?.rotation_period_ms)) {
            rotationPeriodMs = encryptionParams?.rotation_period_ms;
        }
        let rotationPeriodMsgs = 100; // default
        if (Number.isSafeInteger(encryptionParams?.rotation_period_msgs)) {
            rotationPeriodMsgs = encryptionParams?.rotation_period_msgs;
        }

        if (this._now() > (createdAt + rotationPeriodMs)) {
            return true;
        }
        if (session.message_index() >= rotationPeriodMsgs) {
            return true;
        }
    }

    _encryptContent(roomId: string, session: OutboundGroupSession, type: string, content: string): EncryptedContent {
        const plaintext = JSON.stringify({
            room_id: roomId,
            type,
            content
        });
        const ciphertext = session.encrypt(plaintext);

        const encryptedContent = {
            algorithm: MEGOLM_ALGORITHM,
            sender_key: this._account.identityKeys.curve25519,
            ciphertext,
            session_id: session.session_id(),
            device_id: this._ownDeviceId
        };

        return encryptedContent;
    }

    _createRoomKeyMessage(session: OutboundGroupSession, roomId: string): RoomKeyMessage {
        return {
            room_id: roomId,
            session_id: session.session_id(),
            session_key: session.session_key(),
            algorithm: MEGOLM_ALGORITHM,
            // chain_index is ignored by element-web if not all clients
            // but let's send it anyway, as element-web does so
            chain_index: session.message_index()
        };
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
    content: EncryptedContent;
    roomKeyMessage: RoomKeyMessage;

    constructor(content: EncryptedContent, roomKeyMessage: RoomKeyMessage) {
        this.content = content;
        this.roomKeyMessage = roomKeyMessage;
    }
}


type WithheldMessage = {
    algorithm: string;
    code: string;
    reason: string;
    room_id: string;
    sender_key: any;
    session_id: string;
};

type EncryptedContent = {
    algorithm: MEGOLM_ALGORITHM;
    sender_key: string;
    ciphertext: string;
    session_id: string;
    device_id: string;
};