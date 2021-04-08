/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {MemberChange, RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../members/RoomMember.js";
import {LRUCache} from "../../../../utils/LRUCache.js";

export class MemberWriter {
    constructor(roomId) {
        this._roomId = roomId;
        this._cache = new LRUCache(5, member => member.userId);
    }

    writeTimelineMemberEvent(event, txn) {
        return this._writeMemberEvent(event, false, txn);
    }

    writeStateMemberEvent(event, isLimited, txn) {
        // member events in the state section when the room response
        // is not limited must always be lazy loaded members.
        // If they are not, they will be repeated in the timeline anyway.
        return this._writeMemberEvent(event, !isLimited, txn);
    }

    async _writeMemberEvent(event, isLazyLoadingMember, txn) {
        const userId = event.state_key;
        if (!userId) {
            return;
        }
        const member = RoomMember.fromMemberEvent(this._roomId, event);
        if (!member) {
            return;
        }

        let existingMember = this._cache.get(userId);
        if (!existingMember) {
            const memberData = await txn.roomMembers.get(this._roomId, userId);
            if (memberData) {
                existingMember = new RoomMember(memberData);
            }
        }

        // either never heard of the member, or something changed
        if (!existingMember || !existingMember.equals(member)) {
            txn.roomMembers.set(member.serialize());
            this._cache.set(member);
            // we also return a member change for lazy loading members if something changed,
            // so when the dupe timeline event comes and it doesn't see a diff
            // with the cache, we already returned the event here.
            // 
            // it's just important that we don't consider the first LL event
            // for a user we see as a membership change, or we'll share keys with
            // them, etc...
            if (isLazyLoadingMember && !existingMember) {
                // we don't have a previous member, but we know this is not a
                // membership change as it's a lazy loaded
                // member so take the membership from the member
                return new MemberChange(member, member.membership);
            }
            return new MemberChange(member, existingMember?.membership);
        }
    }

    async lookupMember(userId, event, timelineEvents, txn) {
        let member = this._cache.get(userId);
        if (!member) {
            const memberData = await txn.roomMembers.get(this._roomId, userId);
            if (memberData) {
                member = new RoomMember(memberData);
                this._cache.set(member);
            }
        }
        if (!member) {
            // sometimes the member event isn't included in state, but rather in the timeline,
            // even if it is not the first event in the timeline. In this case, go look for
            // the last one before the event, or if none is found,
            // the least recent matching member event in the timeline.
            // The latter is needed because of new joins picking up their own display name
            let foundEvent = false;
            let memberEventBefore;
            let firstMemberEvent;
            for (let i = timelineEvents.length - 1; i >= 0; i -= 1) {
                const e = timelineEvents[i];
                let matchingEvent;
                if (e.type === MEMBER_EVENT_TYPE && e.state_key === userId) {
                    matchingEvent = e;
                    firstMemberEvent = matchingEvent;
                }
                if (!foundEvent) {
                    if (e.event_id === event.event_id) {
                        foundEvent = true;
                    } 
                } else if (matchingEvent) {
                    memberEventBefore = matchingEvent;
                    break;
                }
            }
            // first see if we found a member event before the event we're looking up the sender for
            if (memberEventBefore) {
                member = RoomMember.fromMemberEvent(this._roomId, memberEventBefore);
            }
            // and only if we didn't, fall back to the first member event,
            // regardless of where it is positioned relative to the lookup event
            else if (firstMemberEvent) {
                member = RoomMember.fromMemberEvent(this._roomId, firstMemberEvent);
            }
        }
        return member;
    }
}

export function tests() {

    function createMemberEvent(membership, userId, displayName, avatarUrl) {
        return {
            content: {
                membership,
                "displayname": displayName,
                "avatar_url": avatarUrl
            },
            sender: userId,
            "state_key": userId,
            type: "m.room.member"
        };
    }


    function createStorage(initialMembers = []) {
        const members = new Map();
        for (const m of initialMembers) {
            members.set(m.userId, m);
        }
        return {
            members,
            roomMembers: {
                async get(_, userId) {
                    return members.get(userId);
                },
                set(member) {
                    members.set(member.userId, member);
                }
            }
        }
    }

    function member(...args) {
        return RoomMember.fromMemberEvent(roomId, createMemberEvent.apply(null, args));
    }

    const roomId = "abc";
    const alice = "@alice:hs.tld";
    const avatar = "mxc://hs.tld/def";

    return {
        "new join through state": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const change = await writer.writeStateMemberEvent(createMemberEvent("join", alice), true, txn);
            assert(change.hasJoined);
            assert.equal(txn.members.get(alice).membership, "join");
        },
        "accept invite through state": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("invite", alice)]);
            const change = await writer.writeStateMemberEvent(createMemberEvent("join", alice), true, txn);
            assert.equal(change.previousMembership, "invite");
            assert(change.hasJoined);
            assert.equal(txn.members.get(alice).membership, "join");
        },
        "change display name through timeline": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const change = await writer.writeTimelineMemberEvent(createMemberEvent("join", alice, "Alies"), txn);
            assert(!change.hasJoined);
            assert.equal(change.member.displayName, "Alies");
            assert.equal(txn.members.get(alice).displayName, "Alies");
        },
        "set avatar through timeline": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const change = await writer.writeTimelineMemberEvent(createMemberEvent("join", alice, "Alice", avatar), txn);
            assert(!change.hasJoined);
            assert.equal(change.member.avatarUrl, avatar);
            assert.equal(txn.members.get(alice).avatarUrl, avatar);
        },
        "ignore redundant member event": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice", avatar)]);
            const change = await writer.writeTimelineMemberEvent(createMemberEvent("join", alice, "Alice", avatar), txn);
            assert(!change);
        },
        "leave": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const change = await writer.writeTimelineMemberEvent(createMemberEvent("leave", alice, "Alice"), txn);
            assert(change.hasLeft);
            assert(!change.hasJoined);
        },
        "ban": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const change = await writer.writeTimelineMemberEvent(createMemberEvent("ban", alice, "Alice"), txn);
            assert(change.hasLeft);
            assert(!change.hasJoined);
        },
        "reject invite": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("invite", alice, "Alice")]);
            const change = await writer.writeTimelineMemberEvent(createMemberEvent("leave", alice, "Alice"), txn);
            assert(!change.hasLeft);
            assert(!change.hasJoined);
        },
        "lazy loaded member we already know about doens't return change": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const change = await writer.writeStateMemberEvent(createMemberEvent("join", alice, "Alice"), false, txn);
            assert(!change);
        },
        "lazy loaded member we already know about changes display name": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const change = await writer.writeStateMemberEvent(createMemberEvent("join", alice, "Alies"), false, txn);
            assert.equal(change.member.displayName, "Alies");
        },
        "unknown lazy loaded member returns change, but not considered a membership change": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const change = await writer.writeStateMemberEvent(createMemberEvent("join", alice, "Alice"), false, txn);
            assert(!change.hasJoined);
            assert(!change.hasLeft);
            assert.equal(change.member.membership, "join");
            assert.equal(txn.members.get(alice).displayName, "Alice");
        },
        "newly joined member causes a change with lookup done first": async assert => {
            const event = createMemberEvent("join", alice, "Alice");
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const member = await writer.lookupMember(event.sender, event, [event], txn);
            assert(member);
            const change = await writer.writeTimelineMemberEvent(event, txn);
            assert(change);
        },
        "lookupMember returns closest member in the past": async assert => {
            const event1 = createMemberEvent("join", alice, "Alice");
            const event2 = createMemberEvent("join", alice, "Alies");
            const event3 = createMemberEvent("join", alice, "Alys");
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const member = await writer.lookupMember(event3.sender, event3, [event1, event2, event3], txn);
            assert.equal(member.displayName, "Alies");
        },
    };
}
