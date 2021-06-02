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

import {MAX_UNICODE, MIN_UNICODE} from "./common.js";

function encodeKey(userId, deviceId) {
    return `${userId}|${deviceId}`;
}

function decodeKey(key) {
    const [userId, deviceId] = key.split("|");
    return {userId, deviceId};
}

export class DeviceIdentityStore {
    constructor(store) {
        this._store = store;
    }

    getAllForUserId(userId) {
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(userId, ""));
        return this._store.selectWhile(range, device => {
            return device.userId === userId;
        });
    }

    async getAllDeviceIds(userId) {
        const deviceIds = [];
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(userId, ""));
        await this._store.iterateKeys(range, key => {
            const decodedKey = decodeKey(key);
            // prevent running into the next room
            if (decodedKey.userId === userId) {
                deviceIds.push(decodedKey.deviceId);
                return false;   // fetch more
            }
            return true; // done
        });
        return deviceIds;
    }

    get(userId, deviceId) {
        return this._store.get(encodeKey(userId, deviceId));
    }

    set(deviceIdentity) {
        deviceIdentity.key = encodeKey(deviceIdentity.userId, deviceIdentity.deviceId);
        this._store.put(deviceIdentity);
    }

    getByCurve25519Key(curve25519Key) {
        return this._store.index("byCurve25519Key").get(curve25519Key);
    }

    remove(userId, deviceId) {
        this._store.delete(encodeKey(userId, deviceId));
    }

    removeAllForUser(userId) {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._store.IDBKeyRange.bound(encodeKey(userId, MIN_UNICODE), encodeKey(userId, MAX_UNICODE), true, true);
        this._store.delete(range);
    }
}
