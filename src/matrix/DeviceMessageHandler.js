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

import {OLM_ALGORITHM, MEGOLM_ALGORITHM} from "./e2ee/common.js";

// key to store in session store
const PENDING_ENCRYPTED_EVENTS = "pendingEncryptedDeviceEvents";

export class DeviceMessageHandler {
    constructor({storage}) {
        this._storage = storage;
        this._olmDecryption = null;
        this._megolmDecryption = null;
    }

    enableEncryption({olmDecryption, megolmDecryption}) {
        this._olmDecryption = olmDecryption;
        this._megolmDecryption = megolmDecryption;
    }

    /**
     * @return {bool} whether messages are waiting to be decrypted and `decryptPending` should be called.
     */
    async writeSync(toDeviceEvents, txn) {
        const encryptedEvents = toDeviceEvents.filter(e => e.type === "m.room.encrypted");
        if (!encryptedEvents.length) {
            return false;
        }
        // store encryptedEvents
        let pendingEvents = await this._getPendingEvents(txn);
        pendingEvents = pendingEvents.concat(encryptedEvents);
        txn.session.set(PENDING_ENCRYPTED_EVENTS, pendingEvents);
        // we don't handle anything other for now
        return true;
    }

    /**
     * [_writeDecryptedEvents description]
     * @param  {Array<DecryptionResult>} olmResults
     * @param  {[type]} txn        [description]
     * @return {[type]}            [description]
     */
    async _writeDecryptedEvents(olmResults, txn) {
        const megOlmRoomKeysResults = olmResults.filter(r => {
            return r.event?.type === "m.room_key" && r.event.content?.algorithm === MEGOLM_ALGORITHM;
        });
        let roomKeys;
        if (megOlmRoomKeysResults.length) {
            console.log("new room keys", megOlmRoomKeysResults);
            roomKeys = await this._megolmDecryption.addRoomKeys(megOlmRoomKeysResults, txn);
        }
        return {roomKeys};
    }

    async _applyDecryptChanges(rooms, {roomKeys}) {
        if (Array.isArray(roomKeys)) {
            for (const roomKey of roomKeys) {
                const room = rooms.get(roomKey.roomId);
                // TODO: this is less parallized than it could be (like sync)
                await room?.notifyRoomKey(roomKey);
            }
        }
    }

    // not safe to call multiple times without awaiting first call
    async decryptPending(rooms) {
        if (!this._olmDecryption) {
            return;
        }
        const readTxn = this._storage.readTxn([this._storage.storeNames.session]);
        const pendingEvents = await this._getPendingEvents(readTxn);
        if (pendingEvents.length === 0) {
           return;
        }
        // only know olm for now
        const olmEvents = pendingEvents.filter(e => e.content?.algorithm === OLM_ALGORITHM);
        const decryptChanges = await this._olmDecryption.decryptAll(olmEvents);
        for (const err of decryptChanges.errors) {
            console.warn("decryption failed for event", err, err.event);
        }
        const txn = this._storage.readWriteTxn([
            // both to remove the pending events and to modify the olm account
            this._storage.storeNames.session,
            this._storage.storeNames.olmSessions,
            this._storage.storeNames.inboundGroupSessions,
        ]);
        let changes;
        try {
            changes = await this._writeDecryptedEvents(decryptChanges.results, txn);
            decryptChanges.write(txn);
            txn.session.remove(PENDING_ENCRYPTED_EVENTS);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        await this._applyDecryptChanges(rooms, changes);
    }

    async _getPendingEvents(txn) {
        return (await txn.session.get(PENDING_ENCRYPTED_EVENTS)) || [];
    }
}
