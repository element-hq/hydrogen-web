/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {MAX_UNICODE} from "./common.js";

function encodeKey(roomId, userId) {
    return `${roomId}|${userId}`;
}

function decodeKey(key) {
    const [roomId, userId] = key.split("|");
    return {roomId, userId};
}

// no historical members
export class RoomMemberStore {
    constructor(roomMembersStore) {
        this._roomMembersStore = roomMembersStore;
    }

	get(roomId, userId) {
        return this._roomMembersStore.get(encodeKey(roomId, userId));
	}

	async set(member) {
        member.key = encodeKey(member.roomId, member.userId);
        return this._roomMembersStore.put(member);
	}

    getAll(roomId) {
        const range = this._roomMembersStore.IDBKeyRange.lowerBound(encodeKey(roomId, ""));
        return this._roomMembersStore.selectWhile(range, member => {
            return member.roomId === roomId;
        });
    }

    async getAllUserIds(roomId) {
        const userIds = [];
        const range = this._roomMembersStore.IDBKeyRange.lowerBound(encodeKey(roomId, ""));
        await this._roomMembersStore.iterateKeys(range, key => {
            const decodedKey = decodeKey(key);
            // prevent running into the next room
            if (decodedKey.roomId === roomId) {
                userIds.push(decodedKey.userId);
                return false;   // fetch more
            }
            return true; // done
        });
        return userIds;
    }

    removeAllForRoom(roomId) {
        // exclude both keys as they are theoretical min and max,
        // but we should't have a match for just the room id, or room id with max
        const range = this._roomMembersStore.IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
        this._roomMembersStore.delete(range);
    }
}
