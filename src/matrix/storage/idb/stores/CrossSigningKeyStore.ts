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

// we store cross-signing keys in the format we get them from the server
// as that is what the signature is calculated on, so to verify, we need
// it in this format anyway.
export type CrossSigningKey = {
    readonly user_id: string;
    readonly usage: ReadonlyArray<string>;
    readonly keys: {[keyId: string]: string};
    readonly signatures: {[userId: string]: {[keyId: string]: string}}
}

type CrossSigningKeyEntry = CrossSigningKey & {
    key: string; // key in storage, not a crypto key
}

function encodeKey(userId: string, usage: string): string {
    return `${userId}|${usage}`;
}

function decodeKey(key: string): { userId: string, usage: string } {
    const [userId, usage] = key.split("|");
    return {userId, usage};
}

export class CrossSigningKeyStore {
    private _store: Store<CrossSigningKeyEntry>;
    
    constructor(store: Store<CrossSigningKeyEntry>) {
        this._store = store;
    }

    get(userId: string, deviceId: string): Promise<CrossSigningKey | undefined> {
        return this._store.get(encodeKey(userId, deviceId));
    }

    set(crossSigningKey: CrossSigningKey): void {
        const deviceIdentityEntry = crossSigningKey as CrossSigningKeyEntry;
        deviceIdentityEntry.key = encodeKey(crossSigningKey["user_id"], crossSigningKey.usage[0]);
        this._store.put(deviceIdentityEntry);
    }

    remove(userId: string, usage: string): void {
        this._store.delete(encodeKey(userId, usage));
    }

    removeAllForUser(userId: string): void {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._store.IDBKeyRange.bound(encodeKey(userId, MIN_UNICODE), encodeKey(userId, MAX_UNICODE), true, true);
        this._store.delete(range);
    }
}
