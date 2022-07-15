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
import {LRUCache} from "../../../../utils/LRUCache";

export class MemberWriter {
    constructor(roomId) {
        this._roomId = roomId;
        this._cache = new LRUCache(5, member => member.userId);
    }

    prepareMemberSync(stateEvents, timelineEvents, hasFetchedMembers) {
        return new MemberSync(this, stateEvents, timelineEvents, hasFetchedMembers);
    }

    async _writeMember(member, txn) {
        let existingMember = this._cache.get(member.userId);
        if (!existingMember) {
            const memberData = await txn.roomMembers.get(this._roomId, member.userId);
            if (memberData) {
                existingMember = new RoomMember(memberData);
            }
        }
        // either never heard of the member, or something changed
        if (!existingMember || !existingMember.equals(member)) {
            txn.roomMembers.set(member.serialize());
            this._cache.set(member);
            return new MemberChange(member, existingMember?.membership);
        }
    }

    async lookupMember(userId, txn) {
        let member = this._cache.get(userId);
        if (!member) {
            const memberData = await txn.roomMembers.get(this._roomId, userId);
            if (memberData) {
                member = new RoomMember(memberData);
                this._cache.set(member);
            }
        }
        return member;
    }
}

/** Represents the member changes in a given sync.
 *  Used to write the changes to storage and historical member
 *  information for events in the same sync.
 **/
export class MemberSync {
    constructor(memberWriter, stateEvents, timelineEvents, hasFetchedMembers) {
        this._memberWriter = memberWriter;
        this._timelineEvents = timelineEvents;
        this._hasFetchedMembers = hasFetchedMembers;
        this._newStateMembers = null;
        if (stateEvents) {
            this._newStateMembers = this._stateEventsToMembers(stateEvents);
        }
    }

    get _roomId() {
        return this._memberWriter._roomId;
    }

    _stateEventsToMembers(stateEvents) {
        let members;
        for (const event of stateEvents) {
            if (event.type === MEMBER_EVENT_TYPE) {
                const member = RoomMember.fromMemberEvent(this._roomId, event);
                if (member) {
                    if (!members) {
                        members = new Map();
                    }
                    members.set(member.userId, member);
                }
            }
        }
        return members;
    }

    _timelineEventsToMembers(timelineEvents) {
        let members;
        // iterate backwards to only add the last member in the timeline
        for (let i = timelineEvents.length - 1; i >= 0; i--) {
            const e = timelineEvents[i];
            const userId = e.state_key;
            if (e.type === MEMBER_EVENT_TYPE && !members?.has(userId)) {
                const member = RoomMember.fromMemberEvent(this._roomId, e);
                if (member) {
                    if (!members) {
                        members = new Map();
                    }
                    members.set(member.userId, member);
                }
            }
        }
        return members;
    }

    async lookupMemberAtEvent(userId, event, txn) {
        let member;
        if (this._timelineEvents) {
            member = this._findPrecedingMemberEventInTimeline(userId, event);
            if (member) {
                return member;
            }
        }
        member = this._newStateMembers?.get(userId);
        if (member) {
            return member;
        }
        return await this._memberWriter.lookupMember(userId, txn);
    }

    async write(txn) {
        const memberChanges = new Map();
        let newTimelineMembers;
        if (this._timelineEvents) {
            newTimelineMembers = this._timelineEventsToMembers(this._timelineEvents);
        }
        if (this._newStateMembers) {
            for (const member of this._newStateMembers.values()) {
                if (!newTimelineMembers?.has(member.userId)) {
                    const memberChange = await this._memberWriter._writeMember(member, txn);
                    if (memberChange) {
                        // if the member event appeared only in the state section,
                        // AND we haven't heard about it AND we haven't fetched all members yet (to avoid #470),
                        // this may be a lazy loading member (if it's not in a gap, we are certain
                        // it is a ll member, in a gap, we can't tell), so we pass in our own membership as
                        // as the previous one so we won't consider it a join to not have false positives (to avoid #192).
                        // see also MemberChange.hasJoined
                        const maybeLazyLoadingMember = !this._hasFetchedMembers && !memberChange.previousMembership;
                        if (maybeLazyLoadingMember) {
                            memberChange.previousMembership = member.membership;
                        }
                        memberChanges.set(memberChange.userId, memberChange);
                    }
                }
            }
        }
        if (newTimelineMembers) {
            for (const member of newTimelineMembers.values()) {
                const memberChange = await this._memberWriter._writeMember(member, txn);
                if (memberChange) {
                    memberChanges.set(memberChange.userId, memberChange);
                }
            }
        }
        return memberChanges;
    }

    // try to find the first member event before the given event,
    // so we respect historical display names within the chunk of timeline
    _findPrecedingMemberEventInTimeline(userId, event) {
        let eventIndex = -1;
        for (let i = this._timelineEvents.length - 1; i >= 0; i--) {
            const e = this._timelineEvents[i];
            if (e.event_id === event.event_id) {
                eventIndex = i;
                break;
            }
        }
        for (let i = eventIndex - 1; i >= 0; i--) {
            const e = this._timelineEvents[i];
            if (e.type === MEMBER_EVENT_TYPE && e.state_key === userId) {
                const member = RoomMember.fromMemberEvent(this._roomId, e);
                if (member) {
                    return member;
                }
            }
        }
    }
}

export function tests() {

    let idCounter = 0;

    function createMemberEvent(membership, userId, displayName, avatarUrl) {
        idCounter += 1;
        return {
            content: {
                membership,
                "displayname": displayName,
                "avatar_url": avatarUrl
            },
            event_id: `$${idCounter}`,
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
        "new join": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice)], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
            assert.equal(txn.members.get(alice).membership, "join");
        },
        "accept invite": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("invite", alice)]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice)], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert.equal(change.previousMembership, "invite");
            assert(change.hasJoined);
            assert.equal(txn.members.get(alice).membership, "join");
        },
        "change display name": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "Alies")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert.equal(change.member.displayName, "Alies");
            assert.equal(txn.members.get(alice).displayName, "Alies");
        },
        "set avatar": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "Alice", avatar)], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert.equal(change.member.avatarUrl, avatar);
            assert.equal(txn.members.get(alice).avatarUrl, avatar);
        },
        "ignore redundant member event in timeline": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice", avatar)]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "Alice", avatar)], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
        "ignore redundant member event in state": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice", avatar)]);
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alice", avatar)], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
        "leave": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("leave", alice, "Alice")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasLeft);
            assert(!change.hasJoined);
        },
        "ban": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("ban", alice, "Alice")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasLeft);
            assert(!change.hasJoined);
        },
        "reject invite": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("invite", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("leave", alice, "Alice")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasLeft);
            assert(!change.hasJoined);
        },
        "lazy loaded member we already know about doens't return change": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alice")], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
        "lazy loaded member we already know about changes display name": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alies")], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert.equal(change.member.displayName, "Alies");
        },
        "unknown lazy loaded member returns change, but not considered a join": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alice")], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert(!change.hasLeft);
            assert.equal(change.member.membership, "join");
            assert.equal(txn.members.get(alice).displayName, "Alice");
        },
        "new join through both timeline and state": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const aliceJoin = createMemberEvent("join", alice, "Alice");
            const memberSync = writer.prepareMemberSync([aliceJoin], [aliceJoin], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
            assert(!change.hasLeft);
        },
        "change display name in timeline with lazy loaded member in state": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = writer.prepareMemberSync(
                [createMemberEvent("join", alice, "Alice")],
                [createMemberEvent("join", alice, "Alies")],
                false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
            assert(!change.hasLeft);
            assert.equal(change.member.displayName, "Alies");
        },
        "lookupMemberAtEvent returns closest member in the past": async assert => {
            const event1 = createMemberEvent("join", alice, "Alice");
            const event2 = createMemberEvent("join", alice, "Alies");
            const event3 = createMemberEvent("join", alice, "Alys");
            const events = [event1, event2, event3];
            // we write first because the MemberWriter assumes it is called before
            // the SyncWriter does any lookups
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = await writer.prepareMemberSync([], events, false);
            let member = await memberSync.lookupMemberAtEvent(event1.sender, event1, txn);
            assert.equal(member, undefined);
            member = await memberSync.lookupMemberAtEvent(event2.sender, event2, txn);
            assert.equal(member.displayName, "Alice");
            member = await memberSync.lookupMemberAtEvent(event3.sender, event3, txn);
            assert.equal(member.displayName, "Alies");

            assert.equal(txn.members.size, 0);
            const changes = await memberSync.write(txn);
            assert.equal(txn.members.size, 1);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
        },
        "lookupMemberAtEvent falls back on state event": async assert => {
            const event1 = createMemberEvent("join", alice, "Alice");
            const event2 = createMemberEvent("join", alice, "Alies");
            // we write first because the MemberWriter assumes it is called before
            // the SyncWriter does any lookups
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = await writer.prepareMemberSync([event1], [event2], false);
            const member = await memberSync.lookupMemberAtEvent(event2.sender, event2, txn);
            assert.equal(member.displayName, "Alice");

            assert.equal(txn.members.size, 0);
            const changes = await memberSync.write(txn);
            assert.equal(txn.members.size, 1);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
        },
        "write works without event arrays": async assert => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = await writer.prepareMemberSync(undefined, undefined, false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
    };
}
