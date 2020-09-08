/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {EventKey} from "../EventKey.js";
import {EventEntry} from "../entries/EventEntry.js";
import {FragmentBoundaryEntry} from "../entries/FragmentBoundaryEntry.js";
import {createEventEntry} from "./common.js";
import {MemberChange, RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../members/RoomMember.js";

// Synapse bug? where the m.room.create event appears twice in sync response
// when first syncing the room
function deduplicateEvents(events) {
    const eventIds = new Set();
    return events.filter(e => {
        if (eventIds.has(e.event_id)) {
            return false;
        } else {
            eventIds.add(e.event_id);
            return true;
        }
    });
}

export class SyncWriter {
    constructor({roomId, fragmentIdComparer}) {
        this._roomId = roomId;
        this._fragmentIdComparer = fragmentIdComparer;
        this._lastLiveKey = null;
    }

    async load(txn) {
        const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
        if (liveFragment) {
            const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, liveFragment.id, 1);
            // sorting and identifying (e.g. sort key and pk to insert) are a bit intertwined here
            // we could split it up into a SortKey (only with compare) and
            // a EventKey (no compare or fragment index) with nextkey methods and getters/setters for eventIndex/fragmentId
            // we probably need to convert from one to the other though, so bother?
            this._lastLiveKey = new EventKey(liveFragment.id, lastEvent.eventIndex);
        }
        // if there is no live fragment, we don't create it here because load gets a readonly txn.
        // this is on purpose, load shouldn't modify the store
        console.log("room persister load", this._roomId, this._lastLiveKey && this._lastLiveKey.toString());
    }

    async _createLiveFragment(txn, previousToken) {
        const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
        if (!liveFragment) {
            if (!previousToken) {
                previousToken = null;
            }
            const fragment = {
                roomId: this._roomId,
                id: EventKey.defaultLiveKey.fragmentId,
                previousId: null,
                nextId: null,
                previousToken: previousToken,
                nextToken: null
            };
            txn.timelineFragments.add(fragment);
            this._fragmentIdComparer.add(fragment);
            return fragment;
        } else {
            return liveFragment;
        }
    }

    async _replaceLiveFragment(oldFragmentId, newFragmentId, previousToken, txn) {
        const oldFragment = await txn.timelineFragments.get(this._roomId, oldFragmentId);
        if (!oldFragment) {
            throw new Error(`old live fragment doesn't exist: ${oldFragmentId}`);
        }
        oldFragment.nextId = newFragmentId;
        txn.timelineFragments.update(oldFragment);
        const newFragment = {
            roomId: this._roomId,
            id: newFragmentId,
            previousId: oldFragmentId,
            nextId: null,
            previousToken: previousToken,
            nextToken: null
        };
        txn.timelineFragments.add(newFragment);
        this._fragmentIdComparer.append(newFragmentId, oldFragmentId);
        return {oldFragment, newFragment};
    }

    async _writeMember(event, trackNewlyJoined, txn) {
        const userId = event.state_key;
        if (userId) {
            const memberChange = new MemberChange(this._roomId, event);
            const {member} = memberChange;
            if (member) {
                if (trackNewlyJoined) {
                    const existingMemberData = await txn.roomMembers.get(this._roomId, userId);
                    // mark new members so we know who needs our the room key for our outbound megolm session
                    member.needsRoomKey = existingMemberData?.needsRoomKey || memberChange.hasJoined;
                }
                txn.roomMembers.set(member.serialize());
                return memberChange;
            }
        }
    }

    async _writeStateEvent(event, trackNewlyJoined, txn) {
        if (event.type === MEMBER_EVENT_TYPE) {
            return await this._writeMember(event, trackNewlyJoined, txn);
        } else {
            txn.roomState.set(this._roomId, event);
        }
    }

    async _writeStateEvents(roomResponse, trackNewlyJoined, txn) {
        const memberChanges = new Map();
        // persist state
        const {state} = roomResponse;
        if (Array.isArray(state?.events)) {
            await Promise.all(state.events.map(async event => {
                const memberChange = await this._writeStateEvent(event, trackNewlyJoined, txn);
                if (memberChange) {
                    memberChanges.set(memberChange.userId, memberChange);
                }
            }));
        }
        return memberChanges;
    }

    async _writeTimeline(entries, timeline, currentKey, trackNewlyJoined, txn) {
        const memberChanges = new Map();
        if (timeline.events) {
            const events = deduplicateEvents(timeline.events);
            for(const event of events) {
                // store event in timeline
                currentKey = currentKey.nextKey();
                const entry = createEventEntry(currentKey, this._roomId, event);
                let memberData = await this._findMemberData(event.sender, events, txn);
                if (memberData) {
                    entry.displayName = memberData.displayName;
                    entry.avatarUrl = memberData.avatarUrl;
                }
                txn.timelineEvents.insert(entry);
                entries.push(new EventEntry(entry, this._fragmentIdComparer));
            }
            // process live state events first, so new member info is available
            // also run async state event writing in parallel
            await Promise.all(events.filter(event => {
                return typeof event.state_key === "string";
            }).map(async stateEvent => {
                const memberChange = await this._writeStateEvent(stateEvent, trackNewlyJoined, txn);
                if (memberChange) {
                    memberChanges.set(memberChange.userId, memberChange);
                }
            }));
        }
        return {currentKey, memberChanges};
    }

    async _findMemberData(userId, events, txn) {
        // TODO: perhaps add a small cache here?
        const memberData = await txn.roomMembers.get(this._roomId, userId);
        if (memberData) {
            return memberData;
        } else {
            // sometimes the member event isn't included in state, but rather in the timeline,
            // even if it is not the first event in the timeline. In this case, go look for the
            // first occurence
            const memberEvent = events.find(e => {
                return e.type === MEMBER_EVENT_TYPE && e.state_key === userId;
            });
            if (memberEvent) {
                return RoomMember.fromMemberEvent(this._roomId, memberEvent)?.serialize(); 
            }
        }
    }

    /**
     * @type {SyncWriterResult}
     * @property {Array<BaseEntry>} entries new timeline entries written
     * @property {EventKey} newLiveKey the advanced key to write events at
     * @property {Map<string, MemberChange>} memberChanges member changes in the processed sync ny user id
     * 
     * @param  {Object}  roomResponse [description]
     * @param  {Boolean} trackNewlyJoined  needed to know if we need to keep track whether a user needs keys when they join an encrypted room
     * @param  {Transaction}  txn     
     * @return {SyncWriterResult}
     */
    async writeSync(roomResponse, trackNewlyJoined, txn) {
        const entries = [];
        const {timeline} = roomResponse;
        let currentKey = this._lastLiveKey;
        if (!currentKey) {
            // means we haven't synced this room yet (just joined or did initial sync)
            
            // as this is probably a limited sync, prev_batch should be there
            // (but don't fail if it isn't, we won't be able to back-paginate though)
            let liveFragment = await this._createLiveFragment(txn, timeline.prev_batch);
            currentKey = new EventKey(liveFragment.id, EventKey.defaultLiveKey.eventIndex);
            entries.push(FragmentBoundaryEntry.start(liveFragment, this._fragmentIdComparer));
        } else if (timeline.limited) {
            // replace live fragment for limited sync, *only* if we had a live fragment already
            const oldFragmentId = currentKey.fragmentId;
            currentKey = currentKey.nextFragmentKey();
            const {oldFragment, newFragment} = await this._replaceLiveFragment(oldFragmentId, currentKey.fragmentId, timeline.prev_batch, txn);
            entries.push(FragmentBoundaryEntry.end(oldFragment, this._fragmentIdComparer));
            entries.push(FragmentBoundaryEntry.start(newFragment, this._fragmentIdComparer));
        }
        // important this happens before _writeTimeline so
        // members are available in the transaction
        const memberChanges = this._writeStateEvents(roomResponse, trackNewlyJoined, txn);
        const timelineResult = await this._writeTimeline(entries, timeline, currentKey, trackNewlyJoined, txn);
        currentKey = timelineResult.currentKey;
        // merge member changes from state and timeline, giving precedence to the latter
        for (const [userId, memberChange] of timelineResult.memberChanges.entries()) {
            memberChanges.set(userId, memberChange);
        }
        return {entries, newLiveKey: currentKey, memberChanges};
    }

    afterSync(newLiveKey) {
        this._lastLiveKey = newLiveKey;
    }

    get lastMessageKey() {
        return this._lastLiveKey;
    }
}

//import MemoryStorage from "../storage/memory/MemoryStorage.js";

export function xtests() {
    const roomId = "!abc:hs.tld";

    // sets sortKey and roomId on an array of entries
    function createTimeline(roomId, entries) {
        let key = new SortKey();
        for (let entry of entries) {
            if (entry.gap && entry.gap.prev_batch) {
                key = key.nextKeyWithGap();
            }
            entry.sortKey = key;
            if (entry.gap && entry.gap.next_batch) {
                key = key.nextKeyWithGap();
            } else if (!entry.gap) {
                key = key.nextKey();
            }
            entry.roomId = roomId;
        }
    }

    function areSorted(entries) {
        for (var i = 1; i < entries.length; i++) {
            const isSorted = entries[i - 1].sortKey.compare(entries[i].sortKey) < 0;
            if(!isSorted) {
                return false
            }
        }
        return true;
    }

    return {
        "test backwards gap fill with overlapping neighbouring event": async function(assert) {
            const currentPaginationToken = "abc";
            const gap = {gap: {prev_batch: currentPaginationToken}};
            const storage = new MemoryStorage({roomTimeline: createTimeline(roomId, [
                {event: {event_id: "b"}},
                {gap: {next_batch: "ghi"}},
                gap,
            ])});
            const persister = new RoomPersister({roomId, storage});
            const response = {
                start: currentPaginationToken,
                end: "def",
                chunk: [
                    {event_id: "a"},
                    {event_id: "b"},
                    {event_id: "c"},
                    {event_id: "d"},
                ]
            };
            const {newEntries, replacedEntries} = await persister.persistGapFill(gap, response);
            // should only have taken events up till existing event
            assert.equal(newEntries.length, 2);
            assert.equal(newEntries[0].event.event_id, "c");
            assert.equal(newEntries[1].event.event_id, "d");
            assert.equal(replacedEntries.length, 2);
            assert.equal(replacedEntries[0].gap.next_batch, "hij");
            assert.equal(replacedEntries[1].gap.prev_batch, currentPaginationToken);
            assert(areSorted(newEntries));
            assert(areSorted(replacedEntries));
        },
        "test backwards gap fill with non-overlapping neighbouring event": async function(assert) {
            const currentPaginationToken = "abc";
            const newPaginationToken = "def";
            const gap = {gap: {prev_batch: currentPaginationToken}};
            const storage = new MemoryStorage({roomTimeline: createTimeline(roomId, [
                {event: {event_id: "a"}},
                {gap: {next_batch: "ghi"}},
                gap,
            ])});
            const persister = new RoomPersister({roomId, storage});
            const response = {
                start: currentPaginationToken,
                end: newPaginationToken,
                chunk: [
                    {event_id: "c"},
                    {event_id: "d"},
                    {event_id: "e"},
                    {event_id: "f"},
                ]
            };
            const {newEntries, replacedEntries} = await persister.persistGapFill(gap, response);
            // should only have taken events up till existing event
            assert.equal(newEntries.length, 5);
            assert.equal(newEntries[0].gap.prev_batch, newPaginationToken);
            assert.equal(newEntries[1].event.event_id, "c");
            assert.equal(newEntries[2].event.event_id, "d");
            assert.equal(newEntries[3].event.event_id, "e");
            assert.equal(newEntries[4].event.event_id, "f");
            assert(areSorted(newEntries));

            assert.equal(replacedEntries.length, 1);
            assert.equal(replacedEntries[0].gap.prev_batch, currentPaginationToken);
        },
    }
}
