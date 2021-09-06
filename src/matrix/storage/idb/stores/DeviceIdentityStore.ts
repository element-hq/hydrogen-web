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

import {MAX_UNICODE, MIN_UNICODE} from "./common";
import {Store} from "../Store";

interface DeviceIdentity {
    userId: string;
    deviceId: string;
    ed25519Key: string;
    curve25519Key: string;
    algorithms: string[];
    displayName: string;
    key: string;
}

function encodeKey(userId: string, deviceId: string): string {
    return `${userId}|${deviceId}`;
}

function decodeKey(key: string): { userId: string, deviceId: string } {
    const [userId, deviceId] = key.split("|");
    return {userId, deviceId};
}

export class DeviceIdentityStore {
    private _store: Store<DeviceIdentity>;
    
    constructor(store: Store<DeviceIdentity>) {
        this._store = store;
    }

    getAllForUserId(userId: string): Promise<DeviceIdentity[]> {
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(userId, ""));
        return this._store.selectWhile(range, device => {
            return device.userId === userId;
        });
    }

    async getAllDeviceIds(userId: string): Promise<string[]> {
        const deviceIds: string[] = [];
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(userId, ""));
        await this._store.iterateKeys(range, key => {
            const decodedKey = decodeKey(key as string);
            // prevent running into the next room
            if (decodedKey.userId === userId) {
                deviceIds.push(decodedKey.deviceId);
                return false;   // fetch more
            }
            return true; // done
        });
        return deviceIds;
    }

    get(userId: string, deviceId: string): Promise<DeviceIdentity | null> {
        return this._store.get(encodeKey(userId, deviceId));
    }

    set(deviceIdentity: DeviceIdentity): void {
        deviceIdentity.key = encodeKey(deviceIdentity.userId, deviceIdentity.deviceId);
        this._store.put(deviceIdentity);
    }

    getByCurve25519Key(curve25519Key: string): Promise<DeviceIdentity | null> {
        return this._store.index("byCurve25519Key").get(curve25519Key);
    }

    remove(userId: string, deviceId: string): Promise<undefined> {
        return this._store.delete(encodeKey(userId, deviceId));
    }

    removeAllForUser(userId: string): Promise<undefined> {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._store.IDBKeyRange.bound(encodeKey(userId, MIN_UNICODE), encodeKey(userId, MAX_UNICODE), true, true);
        return this._store.delete(range);
    }
}
