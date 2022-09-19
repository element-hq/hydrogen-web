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

import {RoomMember} from "./RoomMember";
import type {SummaryData} from "../RoomSummary";
import type {Transaction} from "../../storage/idb/Transaction";
import type {MemberChange} from "./RoomMember";
import type {ILogItem} from "../../../logging/types";
import { Profile, UserIdProfile } from "../../profile";

export function calculateRoomName(
    sortedMembers: RoomMember[] | Profile[] | UserIdProfile[],
    summaryData: { joinCount: number; inviteCount: number },
    log: ILogItem
): string | undefined {
    const countWithoutMe = summaryData.joinCount + summaryData.inviteCount - 1;
    if (sortedMembers.length >= countWithoutMe) {
        if (sortedMembers.length > 1) {
            const lastMember = sortedMembers[sortedMembers.length - 1];
            const firstMembers = sortedMembers.slice(0, sortedMembers.length - 1);
            return firstMembers.map(m => m.name).join(", ") + " and " + lastMember.name;
        } else {
            const otherMember: RoomMember | Profile | UserIdProfile= sortedMembers[0];
            if (otherMember) {
                return otherMember.name;
            } else {
                log.log({l: "could get get other member name", length: sortedMembers.length, otherMember: !!otherMember});
                return "Unknown DM Name";
            }
        }
    } else if (sortedMembers.length < countWithoutMe) {
        return sortedMembers.map(m => m.name).join(", ") + ` and ${countWithoutMe} others`;
    } else {
        // Empty Room
        return undefined;
    }
}

export class Heroes {
    private _roomId: string;
    private _roomName?: string;
    private _members = new Map<string, RoomMember>();

    constructor(roomId: string) {
        this._roomId = roomId;
    }

    async calculateChanges(
        newHeroes: string[],
        memberChanges: Map<string, MemberChange>,
        txn: Transaction
    ): Promise<{
        updatedHeroMembers: IterableIterator<RoomMember>;
        removedUserIds: string[];
    }> {
        const updatedHeroMembers = new Map<string, RoomMember>();
        const removedUserIds: Array<string> = [];
        // remove non-present members
        for (const existingUserId of this._members.keys()) {
            if (newHeroes.indexOf(existingUserId) === -1) {
                removedUserIds.push(existingUserId);
            }
        }
        // update heroes with synced member changes
        for (const [userId, memberChange] of memberChanges.entries()) {
            if (this._members.has(userId) || newHeroes.indexOf(userId) !== -1) {
                updatedHeroMembers.set(userId, memberChange.member);
            }
        }
        // load member for new heroes from storage
        for (const userId of newHeroes) {
            if (!this._members.has(userId) && !updatedHeroMembers.has(userId)) {
                const memberData = await txn.roomMembers.get(this._roomId, userId);
                if (memberData) {
                    const member = new RoomMember(memberData);
                    updatedHeroMembers.set(member.userId, member);
                }
            }
        }
        return {updatedHeroMembers: updatedHeroMembers.values(), removedUserIds};
    }

    applyChanges(
        {
            updatedHeroMembers,
            removedUserIds,
        }: {
            updatedHeroMembers: IterableIterator<RoomMember>;
            removedUserIds: string[];
        },
        summaryData: SummaryData,
        log: ILogItem
    ): void {
        for (const userId of removedUserIds) {
            this._members.delete(userId);
        }
        for (const member of updatedHeroMembers) {
            this._members.set(member.userId, member);
        }
        const sortedMembers = Array.from(this._members.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
        this._roomName = calculateRoomName(sortedMembers, summaryData, log);
    }

    get roomName(): string | undefined{
        return this._roomName;
    }

    get roomAvatarUrl(): string | undefined {
        if (this._members.size === 1) {
            for (const member of this._members.values()) {
                return member.avatarUrl;
            }
        }
    }

    /**
     * In DM rooms, we want the room's color to be
     * the same as the other user's color. Thus, if the room
     * only has one hero, we use their ID, instead
     * of the room's, to get the avatar color.
     */
    get roomAvatarColorId(): string | null {
        if (this._members.size === 1) {
            for (const member of this._members.keys()) {
                return member;
            }
        }
        return null;
    }
}