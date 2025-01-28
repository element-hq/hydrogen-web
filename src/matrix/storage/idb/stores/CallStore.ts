/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Store} from "../Store";
import {StateEvent} from "../../types";
import {MIN_UNICODE, MAX_UNICODE} from "./common";

function encodeKey(intent: string, roomId: string, callId: string) {
     return `${intent}|${roomId}|${callId}`;
}

function decodeStorageEntry(storageEntry: CallStorageEntry): CallEntry {
    const [intent, roomId, callId] = storageEntry.key.split("|");
    return {intent, roomId, callId, timestamp: storageEntry.timestamp};
}

export interface CallEntry {
    intent: string;
    roomId: string;
    callId: string;
    timestamp: number;
}

type CallStorageEntry = {
    key: string;
    timestamp: number;
}

export class CallStore {
    private _callStore: Store<CallStorageEntry>;

    constructor(idbStore: Store<CallStorageEntry>) {
        this._callStore = idbStore;
    }

    async getByIntent(intent: string): Promise<CallEntry[]> {
        const range = this._callStore.IDBKeyRange.bound(
            encodeKey(intent, MIN_UNICODE, MIN_UNICODE),
            encodeKey(intent, MAX_UNICODE, MAX_UNICODE),
            true,
            true
        );
        const storageEntries = await this._callStore.selectAll(range);
        return storageEntries.map(e => decodeStorageEntry(e));
    }

    async getByIntentAndRoom(intent: string, roomId: string): Promise<CallEntry[]> {
        const range = this._callStore.IDBKeyRange.bound(
            encodeKey(intent, roomId, MIN_UNICODE),
            encodeKey(intent, roomId, MAX_UNICODE),
            true,
            true
        );
        const storageEntries = await this._callStore.selectAll(range);
        return storageEntries.map(e => decodeStorageEntry(e));
    }

    add(entry: CallEntry) {
        const storageEntry: CallStorageEntry = {
            key: encodeKey(entry.intent, entry.roomId, entry.callId),
            timestamp: entry.timestamp
        };
        this._callStore.add(storageEntry);
    }

    remove(intent: string, roomId: string, callId: string): void {
        this._callStore.delete(encodeKey(intent, roomId, callId));
    }
}
