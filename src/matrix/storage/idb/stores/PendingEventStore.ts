/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

    remove(roomId: string, queueIndex: number) {
        const keyRange = this._eventStore.IDBKeyRange.only(encodeKey(roomId, queueIndex));
        this._eventStore.delete(keyRange);
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

    removeAllForRoom(roomId: string): void {
        const minKey = encodeKey(roomId, KeyLimits.minStorageKey);
        const maxKey = encodeKey(roomId, KeyLimits.maxStorageKey);
        const range = this._eventStore.IDBKeyRange.bound(minKey, maxKey);
        this._eventStore.delete(range);
    }
}
