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

export const EVENT_TYPE = "m.room.member";

export class RoomMember {
    constructor(data) {
        this._data = data;
    }

    static fromMemberEvent(roomId, memberEvent) {
        const userId = memberEvent && memberEvent.state_key;
        if (typeof userId !== "string") {
            return;
        }
        return this._fromMemberEventContent(roomId, userId, memberEvent.content);
    }

    static fromReplacingMemberEvent(roomId, memberEvent) {
        const userId = memberEvent && memberEvent.state_key;
        if (typeof userId !== "string") {
            return;
        }
        return this._fromMemberEventContent(roomId, userId, memberEvent.prev_content);
    }

    static _fromMemberEventContent(roomId, userId, content) {
        const membership = content?.membership;
        const avatarUrl = content?.avatar_url;
        const displayName = content?.displayname;
        if (typeof membership !== "string") {
            return;
        }
        return new RoomMember({
            roomId,
            userId,
            membership,
            avatarUrl,
            displayName,
        });
    }

    get displayName() {
        return this._data.displayName;
    }

    get avatarUrl() {
        return this._data.avatarUrl;
    }

    get roomId() {
        return this._data.roomId;
    }

    get userId() {
        return this._data.userId;
    }

    serialize() {
        return this._data;
    }
}
