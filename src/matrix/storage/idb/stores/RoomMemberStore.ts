/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {MAX_UNICODE} from "./common";
import {Store} from "../Store";

function encodeKey(roomId: string, userId: string) {
    return `${roomId}|${userId}`;
}

function decodeKey(key: string): { roomId: string, userId: string } {
    const [roomId, userId] = key.split("|");
    return {roomId, userId};
}

// TODO: Move to RoomMember when that's TypeScript.
export interface MemberData {
    roomId: string;
    userId: string;
    avatarUrl: string;
    displayName: string;
    membership: "join" | "leave" | "invite" | "ban";
}

type MemberStorageEntry = MemberData & { key: string }

// no historical members
export class RoomMemberStore {
    private _roomMembersStore: Store<MemberStorageEntry>;

    constructor(roomMembersStore: Store<MemberStorageEntry>) {
        this._roomMembersStore = roomMembersStore;
    }

    get(roomId: string, userId: string): Promise<MemberStorageEntry | undefined> {
        return this._roomMembersStore.get(encodeKey(roomId, userId));
    }

    set(member: MemberData): void {
        // Object.assign would be more typesafe, but small objects 
        (member as MemberStorageEntry).key = encodeKey(member.roomId, member.userId);
        this._roomMembersStore.put(member as MemberStorageEntry);
    }

    getAll(roomId: string): Promise<MemberData[]> {
        const range = this._roomMembersStore.IDBKeyRange.lowerBound(encodeKey(roomId, ""));
        return this._roomMembersStore.selectWhile(range, member => {
            return member.roomId === roomId;
        });
    }

    async getAllUserIds(roomId: string): Promise<string[]> {
        const userIds: string[] = [];
        const range = this._roomMembersStore.IDBKeyRange.lowerBound(encodeKey(roomId, ""));
        await this._roomMembersStore.iterateKeys(range, key => {
            const decodedKey = decodeKey(key as string);
            // prevent running into the next room
            if (decodedKey.roomId === roomId) {
                userIds.push(decodedKey.userId);
                return false;   // fetch more
            }
            return true; // done
        });
        return userIds;
    }

    removeAllForRoom(roomId: string): void {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._roomMembersStore.IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
        this._roomMembersStore.delete(range);
    }
}
