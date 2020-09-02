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

    async writeSync(toDeviceEvents, txn) {
        const encryptedEvents = toDeviceEvents.filter(e => e.type === "m.room.encrypted");
        // store encryptedEvents
        let pendingEvents = this._getPendingEvents(txn);
        pendingEvents = pendingEvents.concat(encryptedEvents);
        txn.session.set(PENDING_ENCRYPTED_EVENTS, pendingEvents);
        // we don't handle anything other for now
    }

    async _writeDecryptedEvents(payloads, txn) {
        const megOlmRoomKeysPayloads = payloads.filter(p => {
            return p.event?.type === "m.room_key" && p.event.content?.algorithm === MEGOLM_ALGORITHM;
        });
        let megolmChanges;
        if (megOlmRoomKeysPayloads.length) {
            megolmChanges = await this._megolmDecryption.addRoomKeys(megOlmRoomKeysPayloads, txn);
        }
        return {megolmChanges};
    }

    _applyDecryptChanges({megolmChanges}) {
        if (megolmChanges) {
            this._megolmDecryption.applyRoomKeyChanges(megolmChanges);
        }
    }

    // not safe to call multiple times without awaiting first call
    async decryptPending() {
        if (!this._olmDecryption) {
            return;
        }
        const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
        const pendingEvents = this._getPendingEvents(readTxn);
        // only know olm for now
        const olmEvents = pendingEvents.filter(e => e.content?.algorithm === OLM_ALGORITHM);
        const decryptChanges = await this._olmDecryption.decryptAll(olmEvents);
        for (const err of decryptChanges.errors) {
            console.warn("decryption failed for event", err, err.event);
        }
        const txn = await this._storage.readWriteTxn([
            // both to remove the pending events and to modify the olm account
            this._storage.storeNames.session,
            this._storage.storeNames.olmSessions,
            this._storage.storeNames.inboundGroupSessions,
        ]);
        let changes;
        try {
            changes = await this._writeDecryptedEvents(decryptChanges.payloads, txn);
            decryptChanges.write(txn);
            txn.session.remove(PENDING_ENCRYPTED_EVENTS);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        this._applyDecryptChanges(changes);
    }

    async _getPendingEvents(txn) {
        return (await txn.session.get(PENDING_ENCRYPTED_EVENTS)) || [];
    }
}
