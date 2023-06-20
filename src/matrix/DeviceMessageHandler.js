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

import {OLM_ALGORITHM} from "./e2ee/common";
import {countBy, groupBy} from "../utils/groupBy";
import {LRUCache} from "../utils/LRUCache";
import {EventEmitter} from "../utils/EventEmitter";

export class DeviceMessageHandler extends EventEmitter{
    constructor({storage, callHandler}) {
        super();
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
        this._emitUnencryptedEvents(toDeviceEvents);
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
        const hasNewRoomKeys = didWriteValues.some(didWrite => !!didWrite);
        return {
            hasNewRoomKeys,
            decryptionResults: prep.olmDecryptChanges.results
        };
    }

    async afterSyncCompleted(decryptionResults, deviceTracker, hsApi, log) {
        await log.wrap("Verifying fingerprint of encrypted toDevice messages", async (log) => {
            for (const result of decryptionResults) {
                const sender = result.event.sender;
                const device = await deviceTracker.deviceForCurveKey(
                    sender,
                    result.senderCurve25519Key,
                    hsApi,
                    log
                );
                result.setDevice(device);
                if (result.isVerified) {
                    this.emit("message", { encrypted: result });
                }
                else {
                    log.log({
                        l: "could not verify olm fingerprint key matches, ignoring",
                        ed25519Key: result.device.ed25519Key,
                        claimedEd25519Key: result.claimedEd25519Key,
                        deviceId: device.deviceId,
                        userId: device.userId,
                    });
                }
            }
        });
        // todo: Refactor the following to use to device messages 
        if (this._callHandler) {
            // if we don't have a device, we need to fetch the device keys the message claims
            // and check the keys, and we should only do network requests during
            // sync processing in the afterSyncCompleted step.
            const callMessages = decryptionResults.filter(dr => this._callHandler.handlesDeviceMessageEventType(dr.event?.type));
            if (callMessages.length) {
                await log.wrap("process call signalling messages", async log => {
                    for (const dr of callMessages) {
                        // serialize device loading, so subsequent messages for the same device take advantage of the cache
                        const device = await deviceTracker.deviceForId(dr.event.sender, dr.event.content.device_id, hsApi, log);
                        dr.setDevice(device);
                        if (dr.isVerified) {
                            this._callHandler.handleDeviceMessage(dr.event, dr.userId, dr.deviceId, log);
                        } else {
                            log.log({
                                l: "could not verify olm fingerprint key matches, ignoring",
                                ed25519Key: dr.device.ed25519Key,
                                claimedEd25519Key: dr.claimedEd25519Key,
                                deviceId: device.deviceId,
                                userId: device.userId,
                            });
                        }
                    }
                });
            }
        }
    }

    _emitUnencryptedEvents(toDeviceEvents) {
        const unencryptedEvents = toDeviceEvents.filter(e => e.type !== "m.room.encrypted");
        for (const event of unencryptedEvents) {
            this.emit("message", { unencrypted: event });
        }
    }

}

class SyncPreparation {
    constructor(olmDecryptChanges, newRoomKeys) {
        this.olmDecryptChanges = olmDecryptChanges;
        this.newRoomKeys = newRoomKeys;
        this.newKeysByRoom = groupBy(newRoomKeys, r => r.roomId);
    }
}
