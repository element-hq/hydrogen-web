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

function encodeKey(userId, deviceId) {
    return `${userId}|${deviceId}`;
}

export class DeviceIdentityStore {
    constructor(store) {
        this._store = store;
    }

    getAllForUserId(userId) {
        const range = IDBKeyRange.lowerBound(encodeKey(userId, ""));
        return this._store.selectWhile(range, device => {
            return device.userId === userId;
        });
    }

    get(userId, deviceId) {
        return this._store.get(encodeKey(userId, deviceId));
    }

    set(deviceIdentity) {
        deviceIdentity.key = encodeKey(deviceIdentity.userId, deviceIdentity.deviceId);
        return this._store.put(deviceIdentity);
    }
}
