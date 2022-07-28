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

import {RoomMember} from "./RoomMember.js";

export function calculateRoomName(sortedMembers, summaryData, log) {
    const countWithoutMe = summaryData.joinCount + summaryData.inviteCount - 1;
    if (sortedMembers.length >= countWithoutMe) {
        if (sortedMembers.length > 1) {
            const lastMember = sortedMembers[sortedMembers.length - 1];
            const firstMembers = sortedMembers.slice(0, sortedMembers.length - 1);
            return firstMembers.map(m => m.name).join(", ") + " and " + lastMember.name;
        } else {
            const otherMember = sortedMembers[0];
            if (otherMember) {
                return otherMember.name;
            } else {
                log.log({l: "could get get other member name", length: sortedMembers.length, otherMember: !!otherMember, otherMemberMembership: otherMember?.membership});
                return "Unknown DM Name";
            }
        }
    } else if (sortedMembers.length < countWithoutMe) {
        return sortedMembers.map(m => m.name).join(", ") + ` and ${countWithoutMe} others`;
    } else {
        // Empty Room
        return null;
    }
}

export class Heroes {
    constructor(roomId) {
        this._roomId = roomId;
        this._members = new Map();
    }

    /**
     * @param  {string[]} newHeroes      array of user ids
     * @param  {Map<string, MemberChange>} memberChanges map of changed memberships
     * @param  {Transaction} txn
     * @return {Promise}
     */
    async calculateChanges(newHeroes, memberChanges, txn) {
        const updatedHeroMembers = new Map();
        const removedUserIds = [];
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

    applyChanges({updatedHeroMembers, removedUserIds}, summaryData, log) {
        for (const userId of removedUserIds) {
            this._members.delete(userId);
        }
        for (const member of updatedHeroMembers) {
            if (!removedUserIds.includes(member.userId)) {
                this._members.set(member.userId, member);
            }
        }
        const sortedMembers = Array.from(this._members.values()).sort((a, b) => a.name.localeCompare(b.name));
        this._roomName = calculateRoomName(sortedMembers, summaryData, log);
    }

    get roomName() {
        return this._roomName;
    }

    get roomAvatarUrl() {
        if (this._members.size === 1) {
            for (const member of this._members.values()) {
                return member.avatarUrl;
            }
        }
        return null;
    }

    /**
     * In DM rooms, we want the room's color to be
     * the same as the other user's color. Thus, if the room
     * only has one hero, we use their ID, instead
     * of the room's, to get the avatar color.
     *
     * @returns {?string} the ID of the single hero.
     */
    get roomAvatarColorId() {
        if (this._members.size === 1) {
            for (const member of this._members.keys()) {
                return member
            }
        }
        return null;
    }
}
