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

import {groupBy} from "../../utils/groupBy.js";
import {makeTxnId} from "../common.js";

const ENCRYPTED_TYPE = "m.room.encrypted";

export class RoomEncryption {
    constructor({room, deviceTracker, olmEncryption, megolmEncryption, encryptionParams}) {
        this._room = room;
        this._deviceTracker = deviceTracker;
        this._olmEncryption = olmEncryption;
        this._megolmEncryption = megolmEncryption;
        // content of the m.room.encryption event
        this._encryptionParams = encryptionParams;

        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
        this._megolmSyncCache = this._megolmDecryption.createSessionCache();
        // not `event_id`, but an internal event id passed in to the decrypt methods
        this._eventIdsByMissingSession = new Map();
    }

    notifyTimelineClosed() {
        // empty the backfill cache when closing the timeline
        this._megolmBackfillCache.dispose();
        this._megolmBackfillCache = this._megolmDecryption.createSessionCache();
    }

    async writeMemberChanges(memberChanges, txn) {
        return await this._deviceTracker.writeMemberChanges(this._room, memberChanges, txn);
    }

    async decryptNewSyncEvent(id, event, txn) {
        const payload = await this._megolmDecryption.decryptNewEvent(
            this._room.id, event, this._megolmSyncCache, txn);
        if (!payload) {
            this._addMissingSessionEvent(id, event);
        }
        return payload;
    }

    async decryptNewGapEvent(id, event, txn) {
        const payload = await this._megolmDecryption.decryptNewEvent(
            this._room.id, event, this._megolmBackfillCache, txn);
        if (!payload) {
            this._addMissingSessionEvent(id, event);
        }
        return payload;
    }

    async decryptStoredEvent(id, event, txn) {
        const payload = await this._megolmDecryption.decryptStoredEvent(
            this._room.id, event, this._megolmBackfillCache, txn);
        if (!payload) {
            this._addMissingSessionEvent(id, event);
        }
        return payload;
    }

    _addMissingSessionEvent(id, event) {
        const senderKey = event.content?.["sender_key"];
        const sessionId = event.content?.["session_id"];
        const key = `${senderKey}|${sessionId}`;
        let eventIds = this._eventIdsByMissingSession.get(key);
        if (!eventIds) {
            eventIds = new Set();
            this._eventIdsByMissingSession.set(key, eventIds);
        }
        eventIds.add(id);
    }

    applyRoomKeys(roomKeys) {
        // retry decryption with the new sessions
        const idsToRetry = [];
        for (const roomKey of roomKeys) {
            const key = `${roomKey.senderKey}|${roomKey.sessionId}`;
            const idsForSession = this._eventIdsByMissingSession.get(key);
            if (idsForSession) {
                this._eventIdsByMissingSession.delete(key);
                idsToRetry.push(...Array.from(idsForSession));
            }
        }
        return idsToRetry;
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
