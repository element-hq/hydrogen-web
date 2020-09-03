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


export class RoomEncryption {
    constructor({room, deviceTracker, olmEncryption, encryptionEventContent}) {
        this._room = room;
        this._deviceTracker = deviceTracker;
        this._olmEncryption = olmEncryption;
        // content of the m.room.encryption event
        this._encryptionEventContent = encryptionEventContent;
    }

    async writeMemberChanges(memberChanges, txn) {
        return await this._deviceTracker.writeMemberChanges(this._room, memberChanges, txn);
    }

    async encrypt(type, content, hsApi) {
        await this._deviceTracker.trackRoom(this._room);
        const devices = await this._deviceTracker.deviceIdentitiesForTrackedRoom(this._room.id, hsApi);
        const messages = await this._olmEncryption.encrypt("m.foo", {body: "hello at " + new Date()}, devices, hsApi);
        await this._sendMessagesToDevices("m.room.encrypted", messages, hsApi);
        return {type, content};
        // return {
        //     type: "m.room.encrypted",
        //     content: encryptedContent,
        // }
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
