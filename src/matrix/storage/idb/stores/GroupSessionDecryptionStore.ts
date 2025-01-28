/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {MIN_UNICODE, MAX_UNICODE} from "./common";
import {Store} from "../Store";

function encodeKey(roomId: string, sessionId: string, messageIndex: number | string): string {
    return `${roomId}|${sessionId}|${messageIndex}`;
}

interface GroupSessionDecryption {
    eventId: string;
    timestamp: number;
}

type GroupSessionEntry = GroupSessionDecryption & { key: string }

export class GroupSessionDecryptionStore {
    private _store: Store<GroupSessionEntry>;

    constructor(store: Store<GroupSessionEntry>) {
        this._store = store;
    }

    get(roomId: string, sessionId: string, messageIndex: number): Promise<GroupSessionDecryption | undefined> {
        return this._store.get(encodeKey(roomId, sessionId, messageIndex));
    }

    set(roomId: string, sessionId: string, messageIndex: number, decryption: GroupSessionDecryption): void {
        (decryption as GroupSessionEntry).key = encodeKey(roomId, sessionId, messageIndex);
        this._store.put(decryption as GroupSessionEntry);
    }
    
    removeAllForRoom(roomId: string): void {
        const range = this._store.IDBKeyRange.bound(
            encodeKey(roomId, MIN_UNICODE, MIN_UNICODE),
            encodeKey(roomId, MAX_UNICODE, MAX_UNICODE)
        );
        this._store.delete(range);
    }
}
