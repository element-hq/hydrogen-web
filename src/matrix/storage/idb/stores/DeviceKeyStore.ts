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
import {getDeviceCurve25519Key} from "../../../e2ee/common";
import type {DeviceKey} from "../../../e2ee/common";

type DeviceKeyEntry = {
    key: string; // key in storage, not a crypto key
    curve25519Key: string;
    deviceKey: DeviceKey
}

function encodeKey(userId: string, deviceId: string): string {
    return `${userId}|${deviceId}`;
}

function decodeKey(key: string): { userId: string, deviceId: string } {
    const [userId, deviceId] = key.split("|");
    return {userId, deviceId};
}

export class DeviceKeyStore {
    private _store: Store<DeviceKeyEntry>;
    
    constructor(store: Store<DeviceKeyEntry>) {
        this._store = store;
    }

    async getAllForUserId(userId: string): Promise<DeviceKey[]> {
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(userId, MIN_UNICODE));
        const entries = await this._store.selectWhile(range, device => {
            return device.deviceKey.user_id === userId;
        });
        return entries.map(e => e.deviceKey);
    }

    async getAllDeviceIds(userId: string): Promise<string[]> {
        const deviceIds: string[] = [];
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(userId, MIN_UNICODE));
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

    async get(userId: string, deviceId: string): Promise<DeviceKey | undefined> {
        return (await this._store.get(encodeKey(userId, deviceId)))?.deviceKey;
    }

    set(deviceKey: DeviceKey): void {
        this._store.put({
            key: encodeKey(deviceKey.user_id, deviceKey.device_id),
            curve25519Key: getDeviceCurve25519Key(deviceKey)!,
            deviceKey
        });
    }

    async getByCurve25519Key(curve25519Key: string): Promise<DeviceKey | undefined> {
        const entry = await this._store.index("byCurve25519Key").get(curve25519Key);
        return entry?.deviceKey;
    }

    remove(userId: string, deviceId: string): void {
        this._store.delete(encodeKey(userId, deviceId));
    }

    removeAllForUser(userId: string): void {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._store.IDBKeyRange.bound(encodeKey(userId, MIN_UNICODE), encodeKey(userId, MAX_UNICODE), true, true);
        this._store.delete(range);
    }
}
