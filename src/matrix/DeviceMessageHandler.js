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

import {OLM_ALGORITHM} from "./e2ee/common.js";
import {countBy, groupBy} from "../utils/groupBy";
import {LRUCache} from "../../utils/LRUCache";

export class DeviceMessageHandler {
    constructor({storage, callHandler}) {
        this._storage = storage;
        this._olmDecryption = null;
        this._megolmDecryption = null;
        this._callHandler = callHandler;
        this._senderDeviceCache = new LRUCache(10, di => di.curve25519Key);
    }

    enableEncryption({olmDecryption, megolmDecryption}) {
        this._olmDecryption = olmDecryption;
        this._megolmDecryption = megolmDecryption;
    }

    obtainSyncLock(toDeviceEvents) {
        return this._olmDecryption?.obtainDecryptionLock(toDeviceEvents);
    }

    async prepareSync(toDeviceEvents, lock, txn, log) {
        log.set("messageTypes", countBy(toDeviceEvents, e => e.type));
        const encryptedEvents = toDeviceEvents.filter(e => e.type === "m.room.encrypted");
        if (!this._olmDecryption) {
            log.log("can't decrypt, encryption not enabled", log.level.Warn);
            return;
        }
        // only know olm for now
        const olmEvents = encryptedEvents.filter(e => e.content?.algorithm === OLM_ALGORITHM);
        if (olmEvents.length) {
            const olmDecryptChanges = await this._olmDecryption.decryptAll(olmEvents, lock, txn);
            log.set("decryptedTypes", countBy(olmDecryptChanges.results, r => r.event?.type));
            for (const err of olmDecryptChanges.errors) {
                log.child("decrypt_error").catch(err);
            }
            const newRoomKeys = this._megolmDecryption.roomKeysFromDeviceMessages(olmDecryptChanges.results, log);
            const callMessages = olmDecryptChanges.results.filter(dr => this._callHandler.handlesDeviceMessageEventType(dr.event?.type));
            await Promise.all(callMessages.map(async dr => {
                dr.setDevice(await this._getDevice(dr.senderCurve25519Key, txn));
                this._callHandler.handleDeviceMessage(dr.device.userId, dr.device.deviceId, dr.event.type, dr.event.content, log);
            }));
            // TODO: somehow include rooms that received a call to_device message in the sync state?
            // or have updates flow through event emitter?
            // well, we don't really need to update the room other then when a call starts or stops
            // any changes within the call will be emitted on the call object?
            return new SyncPreparation(olmDecryptChanges, newRoomKeys);
        }
    }

    /** check that prep is not undefined before calling this */
    async writeSync(prep, txn) {
        // write olm changes
        prep.olmDecryptChanges.write(txn);
        const didWriteValues = await Promise.all(prep.newRoomKeys.map(key => this._megolmDecryption.writeRoomKey(key, txn)));
        return didWriteValues.some(didWrite => !!didWrite);
    }


    async _getDevice(senderKey, txn) {
        let device = this._senderDeviceCache.get(senderKey);
        if (!device) {
            device = await txn.deviceIdentities.getByCurve25519Key(senderKey);
            if (device) {
                this._senderDeviceCache.set(device);
            }
        }
        return device;
    }
}

class SyncPreparation {
    constructor(olmDecryptChanges, newRoomKeys) {
        this.olmDecryptChanges = olmDecryptChanges;
        this.newRoomKeys = newRoomKeys;
        this.newKeysByRoom = groupBy(newRoomKeys, r => r.roomId);
    }
}
