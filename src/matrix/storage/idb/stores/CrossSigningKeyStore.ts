/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {MAX_UNICODE, MIN_UNICODE} from "./common";
import {Store} from "../Store";
import type {CrossSigningKey} from "../../../verification/CrossSigning";

type CrossSigningKeyEntry = {
    crossSigningKey: CrossSigningKey
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

    async get(userId: string, deviceId: string): Promise<CrossSigningKey | undefined> {
        return (await this._store.get(encodeKey(userId, deviceId)))?.crossSigningKey;
    }

    set(crossSigningKey: CrossSigningKey): void {
        this._store.put({
            key:encodeKey(crossSigningKey["user_id"], crossSigningKey.usage[0]),
            crossSigningKey
        });
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
