/*
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

import { StateEvent } from "../../storage/types";
import {getPrevContentFromStateEvent} from "../common";
import {MemberStateEvent, Membership} from "../../net/types/roomEvents";

export interface MemberData {
    roomId: string;
    userId: string;
    avatarUrl?: string;
    displayName?: string;
    membership: Membership;
}

export class RoomMember {
    private _data: MemberData;

    constructor(data: MemberData) {
        this._data = data;
    }

    static fromUserId(roomId: string, userId: string, membership: Membership): RoomMember {
        return new RoomMember({roomId, userId, membership});
    }

    static fromMemberEvent(roomId: string, memberEvent: MemberStateEvent): RoomMember | undefined {
        const userId = memberEvent?.state_key;
        if (typeof userId !== "string") {
            return;
        }
        const content = memberEvent.content;
        const prevContent = getPrevContentFromStateEvent(memberEvent);
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
    static fromReplacingMemberEvent(roomId: string, memberEvent: StateEvent): RoomMember | undefined {
        const userId = memberEvent && memberEvent.state_key;
        if (typeof userId !== "string") {
            return;
        }
        const content = getPrevContentFromStateEvent(memberEvent);
        return this._validateAndCreateMember(roomId, userId,
            content?.membership,
            content?.displayname,
            content?.avatar_url
        );
    }

    static _validateAndCreateMember(
        roomId: string,
        userId: string,
        membership: Membership | undefined,
        displayName: string,
        avatarUrl: string
    ): RoomMember | undefined {
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

    get membership(): string {
        return this._data.membership;
    }

    get displayName(): string | undefined {
        return this._data.displayName;
    }

    get name(): string {
        return this._data.displayName || this._data.userId;
    }

    get avatarUrl(): string | undefined {
        return this._data.avatarUrl;
    }

    get roomId(): string {
        return this._data.roomId;
    }

    get userId(): string {
        return this._data.userId;
    }

    serialize(): MemberData {
        return this._data;
    }

    equals(other: RoomMember): boolean {
        const data = this._data;
        const otherData = other._data;
        return data.roomId === otherData.roomId &&
            data.userId === otherData.userId &&
            data.membership === otherData.membership &&
            data.displayName === otherData.displayName &&
            data.avatarUrl === otherData.avatarUrl;
    }
}

export class MemberChange {
    member: RoomMember;
    previousMembership?: string;

    constructor(member: RoomMember, previousMembership: string | undefined) {
        this.member = member;
        this.previousMembership = previousMembership;
    }

    get roomId(): string {
        return this.member.roomId;
    }

    get userId(): string {
        return this.member.userId;
    }

    get membership(): string {
        return this.member.membership;
    }

    get wasInvited(): boolean {
        return this.previousMembership === "invite" && this.membership !== "invite";
    }

    get hasLeft(): boolean {
        return this.previousMembership === "join" && this.membership !== "join";
    }

    /** The result can be a false negative when all of these apply:
     *  - the complete set of room members hasn't been fetched yet.
     *  - the member event for this change was received in the
     *    state section and wasn't present in the timeline section.
     *  - the room response was limited, e.g. there was a gap.
     *
     * This is because during sync, in this case it is not possible
     * to distinguish between a new member that joined the room
     * during a gap and a lazy-loading member.
     * */
    get hasJoined(): boolean {
        return this.previousMembership !== "join" && this.membership === "join";
    }
}