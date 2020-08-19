/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

function encodeKey(roomId, userId) {
    return `${roomId}|${userId}`;
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

}
