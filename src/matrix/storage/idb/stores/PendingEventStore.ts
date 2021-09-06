/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import { encodeUint32, decodeUint32 } from "../utils";
import {KeyLimits} from "../../common";
import {Store} from "../Store";
import {Content} from "../../types";

interface PendingEntry {
    roomId: string;
    queueIndex: number;
    eventType: string;
    content: Content;
    relatexTxnId: string | null;
    relatedEventId: string | null;
    txnId?: string;
    needsEncryption: boolean;
    needsUpload: boolean;
    key: string;
}

function encodeKey(roomId: string, queueIndex: number): string {
    return `${roomId}|${encodeUint32(queueIndex)}`;
}

function decodeKey(key: string): { roomId: string, queueIndex: number } {
    const [roomId, encodedQueueIndex] = key.split("|");
    const queueIndex = decodeUint32(encodedQueueIndex);
    return {roomId, queueIndex};
}

export class PendingEventStore {
    private _eventStore: Store<PendingEntry>;

    constructor(eventStore: Store<PendingEntry>) {
        this._eventStore = eventStore;
    }

    async getMaxQueueIndex(roomId: string): Promise<number | undefined> {
        const range = this._eventStore.IDBKeyRange.bound(
            encodeKey(roomId, KeyLimits.minStorageKey),
            encodeKey(roomId, KeyLimits.maxStorageKey),
            false,
            false,
        );
        const maxKey = await this._eventStore.findMaxKey(range);
        if (maxKey) {
            return decodeKey(maxKey as string).queueIndex;
        }
    }

    remove(roomId: string, queueIndex: number): Promise<undefined> {
        const keyRange = this._eventStore.IDBKeyRange.only(encodeKey(roomId, queueIndex));
        return this._eventStore.delete(keyRange);
    }

    async exists(roomId: string, queueIndex: number): Promise<boolean> {
        const keyRange = this._eventStore.IDBKeyRange.only(encodeKey(roomId, queueIndex));
        const key = await this._eventStore.getKey(keyRange);
        return !!key;
    }
    
    add(pendingEvent: PendingEntry): void {
        pendingEvent.key = encodeKey(pendingEvent.roomId, pendingEvent.queueIndex);
        this._eventStore.add(pendingEvent);
    }

    update(pendingEvent: PendingEntry): void {
        this._eventStore.put(pendingEvent);
    }

    getAll(): Promise<PendingEntry[]> {
        return this._eventStore.selectAll();
    }

    removeAllForRoom(roomId: string): Promise<undefined> {
        const minKey = encodeKey(roomId, KeyLimits.minStorageKey);
        const maxKey = encodeKey(roomId, KeyLimits.maxStorageKey);
        const range = this._eventStore.IDBKeyRange.bound(minKey, maxKey);
        return this._eventStore.delete(range);
    }
}
