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

import {MEGOLM_ALGORITHM} from "./common.js";
import {groupBy} from "../../utils/groupBy.js";
import {makeTxnId} from "../common.js";

const ENCRYPTED_TYPE = "m.room.encrypted";

export class RoomEncryption {
    constructor({room, deviceTracker, olmEncryption, megolmEncryption, megolmDecryption, encryptionParams}) {
        this._room = room;
        this._deviceTracker = deviceTracker;
        this._olmEncryption = olmEncryption;
        this._megolmEncryption = megolmEncryption;
        this._megolmDecryption = megolmDecryption;
        // content of the m.room.encryption event
        this._encryptionParams = encryptionParams;

        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
        this._megolmSyncCache = this._megolmDecryption.createSessionCache();
        // not `event_id`, but an internal event id passed in to the decrypt methods
        this._eventIdsByMissingSession = new Map();
        this._senderDeviceCache = new Map();
    }

    notifyTimelineClosed() {
        // empty the backfill cache when closing the timeline
        this._megolmBackfillCache.dispose();
        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
        this._senderDeviceCache = new Map();    // purge the sender device cache
    }

    async writeMemberChanges(memberChanges, txn) {
        return await this._deviceTracker.writeMemberChanges(this._room, memberChanges, txn);
    }

    async decrypt(event, isSync, isTimelineOpen, retryData, txn) {
        if (event.content?.algorithm !== MEGOLM_ALGORITHM) {
            throw new Error("Unsupported algorithm: " + event.content?.algorithm);
        }
        let sessionCache = isSync ? this._megolmSyncCache : this._megolmBackfillCache;
        const result = await this._megolmDecryption.decrypt(
            this._room.id, event, sessionCache, txn);
        if (!result) {
            this._addMissingSessionEvent(event, isSync, retryData);
        }
        if (result && isTimelineOpen) {
            await this._verifyDecryptionResult(result, txn);
        }
        return result;
    }

    async _verifyDecryptionResult(result, txn) {
        let device = this._senderDeviceCache.get(result.senderCurve25519Key);
        if (!device) {
            device = await this._deviceTracker.getDeviceByCurve25519Key(result.senderCurve25519Key, txn);
            this._senderDeviceCache.set(result.senderCurve25519Key, device);
        }
        if (device) {
            result.setDevice(device);
        } else if (!this._room.isTrackingMembers) {
            result.setRoomNotTrackedYet();
        }
    }

    _addMissingSessionEvent(event, isSync, data) {
        const senderKey = event.content?.["sender_key"];
        const sessionId = event.content?.["session_id"];
        const key = `${senderKey}|${sessionId}`;
        let eventIds = this._eventIdsByMissingSession.get(key);
        if (!eventIds) {
            eventIds = new Map();
            this._eventIdsByMissingSession.set(key, eventIds);
        }
        eventIds.set(event.event_id, {data, isSync});
    }

    applyRoomKeys(roomKeys) {
        // retry decryption with the new sessions
        const retryEntries = [];
        for (const roomKey of roomKeys) {
            const key = `${roomKey.senderKey}|${roomKey.sessionId}`;
            const entriesForSession = this._eventIdsByMissingSession.get(key);
            if (entriesForSession) {
                this._eventIdsByMissingSession.delete(key);
                retryEntries.push(...entriesForSession.values());
            }
        }
        return retryEntries;
    }

    async encrypt(type, content, hsApi) {
        const megolmResult = await this._megolmEncryption.encrypt(this._room.id, type, content, this._encryptionParams);
        // share the new megolm session if needed
        if (megolmResult.roomKeyMessage) {
            await this._deviceTracker.trackRoom(this._room);
            const devices = await this._deviceTracker.deviceIdentitiesForTrackedRoom(this._room.id, hsApi);
            const messages = await this._olmEncryption.encrypt(
                "m.room_key", megolmResult.roomKeyMessage, devices, hsApi);
            await this._sendMessagesToDevices(ENCRYPTED_TYPE, messages, hsApi);
        }
        return {
            type: ENCRYPTED_TYPE,
            content: megolmResult.content
        };
    }

    async _sendMessagesToDevices(type, messages, hsApi) {
        const messagesByUser = groupBy(messages, message => message.device.userId);
        const payload = {
            messages: Array.from(messagesByUser.entries()).reduce((userMap, [userId, messages]) => {
                userMap[userId] = messages.reduce((deviceMap, message) => {
                    deviceMap[message.device.deviceId] = message.content;
                    return deviceMap;
                }, {});
                return userMap;
            }, {})
        };
        const txnId = makeTxnId();
        await hsApi.sendToDevice(type, payload, txnId).response();
    }
}
