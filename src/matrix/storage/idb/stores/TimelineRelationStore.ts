/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {MIN_UNICODE, MAX_UNICODE} from "./common";
import {Store} from "../Store";

function encodeKey(roomId: string, targetEventId: string, relType: string, sourceEventId: string): string {
    return `${roomId}|${targetEventId}|${relType}|${sourceEventId}`;
}

interface RelationEntry {
    roomId: string;
    targetEventId: string;
    sourceEventId: string;
    relType: string;
}

function decodeKey(key: string): RelationEntry {
    const [roomId, targetEventId, relType, sourceEventId] = key.split("|");
    return {roomId, targetEventId, relType, sourceEventId};
}

export class TimelineRelationStore {
    private _store: Store<{ key: string }>;

    constructor(store: Store<{ key: string }>) {
        this._store = store;
    }

    add(roomId: string, targetEventId: string, relType: string, sourceEventId: string): void {
        this._store.add({key: encodeKey(roomId, targetEventId, relType, sourceEventId)});
    }

    remove(roomId: string, targetEventId: string, relType: string, sourceEventId: string): void {
        this._store.delete(encodeKey(roomId, targetEventId, relType, sourceEventId));
    }

    removeAllForTarget(roomId: string, targetId: string): void {
        const range = this._store.IDBKeyRange.bound(
            encodeKey(roomId, targetId, MIN_UNICODE, MIN_UNICODE),
            encodeKey(roomId, targetId, MAX_UNICODE, MAX_UNICODE),
            true,
            true
        );
        this._store.delete(range);
    }

    removeAllForRoom(roomId: string) {
        const range = this._store.IDBKeyRange.bound(
            encodeKey(roomId, MIN_UNICODE, MIN_UNICODE, MIN_UNICODE),
            encodeKey(roomId, MAX_UNICODE, MAX_UNICODE, MAX_UNICODE),
            true,
            true
        );
        this._store.delete(range);
    }

    async getForTargetAndType(roomId: string, targetId: string, relType: string): Promise<RelationEntry[]> {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._store.IDBKeyRange.bound(
            encodeKey(roomId, targetId, relType, MIN_UNICODE),
            encodeKey(roomId, targetId, relType, MAX_UNICODE),
            true,
            true
        );
        const items = await this._store.selectAll(range);
        return items.map(i => decodeKey(i.key));
    }

    async getAllForTarget(roomId: string, targetId: string): Promise<RelationEntry[]> {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._store.IDBKeyRange.bound(
            encodeKey(roomId, targetId, MIN_UNICODE, MIN_UNICODE),
            encodeKey(roomId, targetId, MAX_UNICODE, MAX_UNICODE),
            true,
            true
        );
        const items = await this._store.selectAll(range);
        return items.map(i => decodeKey(i.key));
    }
}
