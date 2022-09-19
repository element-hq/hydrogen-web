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

import {MemberChange, RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../members/RoomMember";
import {LRUCache} from "../../../../utils/LRUCache";
import type {Transaction} from "../../../storage/idb/Transaction";
import { StateEvent } from "../../../storage/types";

export class MemberWriter {
    private _roomId: string;
    private _cache: LRUCache<RoomMember, string>;

    constructor(roomId: string) {
        this._roomId = roomId;
        this._cache = new LRUCache<RoomMember, string>(5, (member: RoomMember) => member.userId);
    }

    prepareMemberSync(stateEvents: StateEvent[], timelineEvents: StateEvent[], hasFetchedMembers: boolean): MemberSync {
        return new MemberSync(this, stateEvents, timelineEvents, hasFetchedMembers);
    }

    async _writeMember(member: RoomMember, txn: Transaction): Promise<MemberChange | undefined> {
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

    async lookupMember(userId: string, txn: Transaction): Promise<RoomMember> {
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

    get roomId(): string {
        return this._roomId;
    }
}

export class MemberSync {
    private _memberWriter: MemberWriter;
    private _stateEvents: StateEvent[];
    private _timelineEvents: StateEvent[];
    private _hasFetchedMembers: boolean;
    private _newStateMembers?: Map<string, RoomMember>;

    constructor(memberWriter: MemberWriter, stateEvents: StateEvent[], timelineEvents: StateEvent[], hasFetchedMembers: boolean) {
        this._memberWriter = memberWriter;
        this._timelineEvents = timelineEvents;
        this._hasFetchedMembers = hasFetchedMembers;
        if (stateEvents) {
            this._newStateMembers = this._stateEventsToMembers(stateEvents);
        }
    }

    get _roomId(): string {
        return this._memberWriter.roomId;
    }

    _stateEventsToMembers(stateEvents: StateEvent[]): Map<string, RoomMember> | undefined {
        let members: Map<string, RoomMember> | undefined;
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

    // TODO: timelineEvents: TimelineEvent[] seems like it would make more sense but TimelineEvent doesn't have state_key
    _timelineEventsToMembers(timelineEvents: StateEvent[]): Map<string, RoomMember> | undefined {
        let members: Map<string, RoomMember> | undefined;
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

    async lookupMemberAtEvent(userId: string, event: StateEvent, txn: Transaction): Promise<RoomMember> {
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

    async write(txn: Transaction): Promise<Map<string, MemberChange | undefined>> {
        const memberChanges = new Map<string, MemberChange | undefined>();
        let newTimelineMembers: Map<string, RoomMember> | undefined;
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
    _findPrecedingMemberEventInTimeline(userId: string, event: StateEvent): RoomMember | undefined {
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {

    let idCounter = 0;

    function createMemberEvent(membership, userId, displayName, avatarUrl): StateEvent {
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
            type: "m.room.member",
            origin_server_ts: 0,
        };
    }

    function createStorage(initialMembers: RoomMember[] = []): any {
        const members = new Map();
        for (const m of initialMembers) {
            members.set(m.userId, m);
        }
        return {
            members,
            roomMembers: {
                async get(_, userId): Promise<any> {
                    return members.get(userId);
                },
                set(member): void {
                    members.set(member.userId, member);
                }
            }
        };
    }

    function member(...args): RoomMember {
        return RoomMember.fromMemberEvent(roomId, createMemberEvent.apply(null, args));
    }

    const roomId = "abc";
    const alice = "@alice:hs.tld";
    const avatar = "mxc://hs.tld/def";

    return {
        "new join": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "", "")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
            assert.equal(txn.members.get(alice).membership, "join");
        },
        "accept invite": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("invite", alice)]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "", "")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert.equal(change.previousMembership, "invite");
            assert(change.hasJoined);
            assert.equal(txn.members.get(alice).membership, "join");
        },
        "change display name": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "Alies", "")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert.equal(change.member.displayName, "Alies");
            assert.equal(txn.members.get(alice).displayName, "Alies");
        },
        "set avatar": async (assert): Promise<void> => {
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
        "ignore redundant member event in timeline": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice", avatar)]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("join", alice, "Alice", avatar)], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
        "ignore redundant member event in state": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice", avatar)]);
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alice", avatar)], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
        "leave": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("leave", alice, "Alice", "")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasLeft);
            assert(!change.hasJoined);
        },
        "ban": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("ban", alice, "Alice", "")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasLeft);
            assert(!change.hasJoined);
        },
        "reject invite": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("invite", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([], [createMemberEvent("leave", alice, "Alice", "")], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasLeft);
            assert(!change.hasJoined);
        },
        "lazy loaded member we already know about doens't return change": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alice", "")], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
        "lazy loaded member we already know about changes display name": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage([member("join", alice, "Alice")]);
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alies", "")], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert.equal(change.member.displayName, "Alies");
        },
        "unknown lazy loaded member returns change, but not considered a join": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = writer.prepareMemberSync([createMemberEvent("join", alice, "Alice", "")], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(!change.hasJoined);
            assert(!change.hasLeft);
            assert.equal(change.member.membership, "join");
            assert.equal(txn.members.get(alice).displayName, "Alice");
        },
        "new join through both timeline and state": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const aliceJoin = createMemberEvent("join", alice, "Alice", "");
            const memberSync = writer.prepareMemberSync([aliceJoin], [aliceJoin], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
            assert(!change.hasLeft);
        },
        "change display name in timeline with lazy loaded member in state": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = writer.prepareMemberSync(
                [createMemberEvent("join", alice, "Alice", "")],
                [createMemberEvent("join", alice, "Alies", "")],
                false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 1);
            const change = changes.get(alice);
            assert(change.hasJoined);
            assert(!change.hasLeft);
            assert.equal(change.member.displayName, "Alies");
        },
        "lookupMemberAtEvent returns closest member in the past": async (assert): Promise<void> => {
            const event1 = createMemberEvent("join", alice, "Alice", "");
            const event2 = createMemberEvent("join", alice, "Alies", "");
            const event3 = createMemberEvent("join", alice, "Alys", "");
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
        "lookupMemberAtEvent falls back on state event": async (assert): Promise<void> => {
            const event1 = createMemberEvent("join", alice, "Alice", "");
            const event2 = createMemberEvent("join", alice, "Alies", "");
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
        "write works without event arrays": async (assert): Promise<void> => {
            const writer = new MemberWriter(roomId);
            const txn = createStorage();
            const memberSync = await writer.prepareMemberSync([], [], false);
            const changes = await memberSync.write(txn);
            assert.equal(changes.size, 0);
        },
    };
}
