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
        const content = memberEvent.content;
        const prevContent = memberEvent.unsigned?.prev_content;
        const membership = content?.membership;
        // fall back to prev_content for these as synapse doesn't (always?)
        // put them on content for "leave" memberships
        const displayName = content?.displayname || prevContent?.displayname;
        const avatarUrl = content?.avatar_url || prevContent?.avatar_url;
        return this._validateAndCreateMember(roomId, userId, membership, displayName, avatarUrl);
    }
    /**
     * Creates a (historical) member from a member event that is the next member event
     * after the point in time where we need a member for. This will use `prev_content`.
     */
    static fromReplacingMemberEvent(roomId, memberEvent) {
        const userId = memberEvent && memberEvent.state_key;
        if (typeof userId !== "string") {
            return;
        }
        const content = memberEvent.unsigned?.prev_content
        return this._validateAndCreateMember(roomId, userId,
            content?.membership,
            content?.displayname,
            content?.avatar_url
        );
    }

    static _validateAndCreateMember(roomId, userId, membership, displayName, avatarUrl) {
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

    /**
     * @return {String?} the display name, if any
     */
    get displayName() {
        return this._data.displayName;
    }

    /**
     * @return {String} the display name or userId
     */
    get name() {
        return this._data.displayName || this._data.userId;
    }

    /**
     * @return {String?} the avatar mxc url, if any
     */
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
