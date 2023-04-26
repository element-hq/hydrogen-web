/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

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
