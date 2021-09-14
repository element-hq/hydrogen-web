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

import {EventKey} from "../EventKey";
import {EventEntry} from "../entries/EventEntry.js";
import {createEventEntry, directionalAppend} from "./common.js";
import {RoomMember, EVENT_TYPE as MEMBER_EVENT_TYPE} from "../../members/RoomMember.js";

export class GapWriter {
    constructor({roomId, storage, fragmentIdComparer, relationWriter}) {
        this._roomId = roomId;
        this._storage = storage;
        this._fragmentIdComparer = fragmentIdComparer;
        this._relationWriter = relationWriter;
    }
    // events is in reverse-chronological order (last event comes at index 0) if backwards
    async _findOverlappingEvents(fragmentEntry, events, txn, log) {
        let expectedOverlappingEventId;
        if (fragmentEntry.hasLinkedFragment) {
            expectedOverlappingEventId = await this._findExpectedOverlappingEventId(fragmentEntry, txn);
        }
        let remainingEvents = events;
        let nonOverlappingEvents = [];
        let neighbourFragmentEntry;
        while (remainingEvents && remainingEvents.length) {
            const eventIds = remainingEvents.map(e => e.event_id);
            const duplicateEventId = await txn.timelineEvents.findFirstOccurringEventId(this._roomId, eventIds);
            if (duplicateEventId) {
                const duplicateEventIndex = remainingEvents.findIndex(e => e.event_id === duplicateEventId);
                // should never happen, just being defensive as this *can't* go wrong
                if (duplicateEventIndex === -1) {
                    throw new Error(`findFirstOccurringEventId returned ${duplicateEventIndex} which wasn't ` +
                        `in [${eventIds.join(",")}] in ${this._roomId}`);
                }
                nonOverlappingEvents.push(...remainingEvents.slice(0, duplicateEventIndex));
                if (!expectedOverlappingEventId || duplicateEventId === expectedOverlappingEventId) {
                    // Only link fragment if this is the first overlapping fragment we discover.
                    // TODO is this sufficient? Might we get "out of order" fragments from events?
                    if (!neighbourFragmentEntry) {
                        // TODO: check here that the neighbourEvent is at the correct edge of it's fragment
                        // get neighbour fragment to link it up later on
                        const neighbourEvent = await txn.timelineEvents.getByEventId(this._roomId, duplicateEventId);
                        const neighbourFragment = await txn.timelineFragments.get(this._roomId, neighbourEvent.fragmentId);
                        neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment);
                    }
                } 
                // If more events remain, or if this wasn't the expected overlapping event,
                // we've hit https://github.com/matrix-org/synapse/issues/7164, 
                // e.g. the event id we found is already in our store but it is not
                // the adjacent fragment id. Ignore the event, but keep processing the ones after.
                remainingEvents = remainingEvents.slice(duplicateEventIndex + 1);
            } else {
                nonOverlappingEvents.push(...remainingEvents);
                remainingEvents = null;
            }
        }
        if (neighbourFragmentEntry?.fragmentId === fragmentEntry.fragmentId) {
            log.log("hit #160, prevent fragment linking to itself", log.level.Warn);
            neighbourFragmentEntry = null;
        } 
        return {nonOverlappingEvents, neighbourFragmentEntry};
    }

    async _findExpectedOverlappingEventId(fragmentEntry, txn) {
        const eventEntry = await this._findFragmentEdgeEvent(
            fragmentEntry.linkedFragmentId,
            // reverse because it's the oppose edge of the linked fragment
            fragmentEntry.direction.reverse(),
            txn);
        if (eventEntry) {
            return eventEntry.event.event_id;
        }
    }

    async _findFragmentEdgeEventKey(fragmentEntry, txn) {
        const {fragmentId, direction} = fragmentEntry;
        const event = await this._findFragmentEdgeEvent(fragmentId, direction, txn);
        if (event) {
            return new EventKey(event.fragmentId, event.eventIndex);
        } else {
            // no events yet in the fragment ... odd, but let's not fail and take the default key
            return EventKey.defaultFragmentKey(fragmentEntry.fragmentId);
        }
    }

    async _findFragmentEdgeEvent(fragmentId, direction, txn) {
        if (direction.isBackward) {
            const [firstEvent] = await txn.timelineEvents.firstEvents(this._roomId, fragmentId, 1);
            return firstEvent;
        } else {
            const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);
            return lastEvent;
        }
    }

    async _storeEvents(events, startKey, direction, state, txn, log) {
        const entries = [];
        const updatedEntries = [];
        // events is in reverse chronological order for backwards pagination,
        // e.g. order is moving away from the `from` point.
        let key = startKey;
        for (let i = 0; i < events.length; ++i) {
            const event = events[i];
            key = key.nextKeyForDirection(direction);
            const eventStorageEntry = createEventEntry(key, this._roomId, event);
            const member = this._findMember(event.sender, state, events, i, direction);
            if (member) {
                eventStorageEntry.displayName = member.displayName;
                eventStorageEntry.avatarUrl = member.avatarUrl;
            }
            // this will modify eventStorageEntry if it is a relation target
            const updatedRelationTargetEntries = await this._relationWriter.writeGapRelation(eventStorageEntry, direction, txn, log);
            if (updatedRelationTargetEntries) {
                updatedEntries.push(...updatedRelationTargetEntries);
            }
            txn.timelineEvents.insert(eventStorageEntry);
            const eventEntry = new EventEntry(eventStorageEntry, this._fragmentIdComparer);
            directionalAppend(entries, eventEntry, direction);
        }
        return {entries, updatedEntries};
    }

    _findMember(userId, state, events, index, direction) {
        function isOurUser(event) {
            return event.type === MEMBER_EVENT_TYPE && event.state_key === userId;
        }
        // older messages are at a higher index in the array when going backwards
        const inc = direction.isBackward ? 1 : -1;
        for (let i = index + inc; i >= 0 && i < events.length; i += inc) {
            const event = events[i];
            if (isOurUser(event)) {
                return RoomMember.fromMemberEvent(this._roomId, event);
            }
        }
        // look into newer events, but using prev_content if found.
        // We do this before looking into `state` because it is not well specified
        // in the spec whether the events in there represent state before or after `chunk`.
        // So we look both directions first in chunk to make sure it doesn't matter.
        for (let i = index; i >= 0 && i < events.length; i -= inc) {
            const event = events[i];
            if (isOurUser(event)) {
                return RoomMember.fromReplacingMemberEvent(this._roomId, event);
            }
        }
        // assuming the member hasn't changed within the chunk, just take it from state if it's there.
        // Don't assume state is set though, as it can be empty at the top of the timeline in some circumstances 
        const stateMemberEvent = state?.find(isOurUser);
        if (stateMemberEvent) {
            return RoomMember.fromMemberEvent(this._roomId, stateMemberEvent);
        }
    }

    async _updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn) {
        const {direction} = fragmentEntry;
        const changedFragments = [];
        directionalAppend(entries, fragmentEntry, direction);
        // set `end` as token, and if we found an event in the step before, link up the fragments in the fragment entry
        if (neighbourFragmentEntry) {
            // the throws here should never happen and are only here to detect client or unhandled server bugs
            // and a last measure to prevent corrupting fragment links
            if (!fragmentEntry.hasLinkedFragment) {
                fragmentEntry.linkedFragmentId = neighbourFragmentEntry.fragmentId;
            } else if (fragmentEntry.linkedFragmentId !== neighbourFragmentEntry.fragmentId) {
                throw new Error(`Prevented changing fragment ${fragmentEntry.fragmentId} ` +
                    `${fragmentEntry.direction.asApiString()} link from ${fragmentEntry.linkedFragmentId} ` +
                    `to ${neighbourFragmentEntry.fragmentId} in ${this._roomId}`);
            }
            if (!neighbourFragmentEntry.hasLinkedFragment) {
                neighbourFragmentEntry.linkedFragmentId = fragmentEntry.fragmentId;
            } else if (neighbourFragmentEntry.linkedFragmentId !== fragmentEntry.fragmentId) {
                throw new Error(`Prevented changing fragment ${neighbourFragmentEntry.fragmentId} ` +
                    `${neighbourFragmentEntry.direction.asApiString()} link from ${neighbourFragmentEntry.linkedFragmentId} ` +
                    `to ${fragmentEntry.fragmentId} in ${this._roomId}`);
            }
            // if neighbourFragmentEntry was found, it means the events were overlapping,
            // so no pagination should happen anymore.
            neighbourFragmentEntry.token = null;
            fragmentEntry.token = null;

            txn.timelineFragments.update(neighbourFragmentEntry.fragment);
            directionalAppend(entries, neighbourFragmentEntry, direction);

            // fragments that need to be changed in the fragmentIdComparer here
            // after txn succeeds
            changedFragments.push(fragmentEntry.fragment);
            changedFragments.push(neighbourFragmentEntry.fragment);
        } else {
            fragmentEntry.token = end;
        }
        txn.timelineFragments.update(fragmentEntry.fragment);

        return changedFragments;
    }

    async writeFragmentFill(fragmentEntry, response, txn, log) {
        const {fragmentId, direction} = fragmentEntry;
        // chunk is in reverse-chronological order when backwards
        const {chunk, start, state} = response;
        let {end} = response;

        if (!Array.isArray(chunk)) {
            throw new Error("Invalid chunk in response");
        }
        if (typeof end !== "string") {
            throw new Error("Invalid end token in response");
        }

        // make sure we have the latest fragment from the store
        const fragment = await txn.timelineFragments.get(this._roomId, fragmentId);
        if (!fragment) {
            throw new Error(`Unknown fragment: ${fragmentId}`);
        }
        fragmentEntry = fragmentEntry.withUpdatedFragment(fragment);
        // check that the request was done with the token we are aware of (extra care to avoid timeline corruption)
        if (fragmentEntry.token !== start) {
            throw new Error("start is not equal to prev_batch or next_batch");
        }

        // begin (or end) of timeline reached
        if (chunk.length === 0) {
            fragmentEntry.edgeReached = true;
            await txn.timelineFragments.update(fragmentEntry.fragment);
            return {entries: [fragmentEntry], updatedEntries: [], fragments: []};
        }

        // find last event in fragment so we get the eventIndex to begin creating keys at
        let lastKey = await this._findFragmentEdgeEventKey(fragmentEntry, txn);
        // find out if any event in chunk is already present using findFirstOrLastOccurringEventId
        const {
            nonOverlappingEvents,
            neighbourFragmentEntry
        } = await this._findOverlappingEvents(fragmentEntry, chunk, txn, log);
        if (!neighbourFragmentEntry && nonOverlappingEvents.length === 0 && typeof end === "string") {
            log.log("hit #160, clearing token", log.level.Warn);
            end = null;
        }
        // create entries for all events in chunk, add them to entries
        const {entries, updatedEntries} = await this._storeEvents(nonOverlappingEvents, lastKey, direction, state, txn, log);
        const fragments = await this._updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn);
    
        return {entries, updatedEntries, fragments};
    }
}

import {FragmentIdComparer} from "../FragmentIdComparer.js";
import {RelationWriter} from "./RelationWriter.js";
import {createMockStorage} from "../../../../mocks/Storage.js";
import {FragmentBoundaryEntry} from "../entries/FragmentBoundaryEntry.js";
import {createEvent, withTextBody, withContent, withSender} from "../../../../mocks/event.js";
import {NullLogger} from "../../../../logging/NullLogger.js";

export function tests() {
    const alice = "alice@hs.tdl";
    const bob = "bob@hs.tdl";
    const roomId = "!room:hs.tdl";
    const startToken = "begin_token";
    const endToken = "end_token";

    class EventCreator {
        constructor() {
            this.counter = 0;
        }

        nextEvent() {
            const event = withTextBody(`This is event ${this.counter}`, withSender(bob, createEvent("m.room.message", `!event${this.counter}`)));
            this.counter++;
            return event;
        }

        nextEvents(n) {
            const events = [];
            for (let i = 0; i < n; i++) {
                events.push(this.nextEvent());
            }
            return events;
        }

        createMessagesResponse() {
            return { 
                start: startToken,
                end: endToken,
                chunk: this.nextEvents(5),
                state: []
            }
        }
    }

    async function createGapFillTxn(storage) {
        return storage.readWriteTxn([
            storage.storeNames.pendingEvents,
            storage.storeNames.timelineEvents,
            storage.storeNames.timelineRelations,
            storage.storeNames.timelineFragments,
        ]);
    }

    async function setup() {
        const storage = await createMockStorage();
        const txn = await createGapFillTxn(storage);
        const fragmentIdComparer = new FragmentIdComparer([]);
        const relationWriter = new RelationWriter({
            roomId, fragmentIdComparer, ownUserId: alice,
        });
        const gapWriter = new GapWriter({
            roomId, storage, fragmentIdComparer, relationWriter
        });
        return { storage, txn, fragmentIdComparer, gapWriter, eventCreator: new EventCreator() };
    }

    async function createFragment(id, txn, fragmentIdComparer, overrides = {}) {
        const newFragment = Object.assign({
            roomId, id,
            previousId: null,
            nextId: null,
            nextToken: null,
            previousToken: null
        }, overrides);
        await txn.timelineFragments.add(newFragment);
        fragmentIdComparer.add(newFragment);
        return newFragment;
    }

    function prefillFragment(txn, eventCreator, fragment, n) {
        let initialKey = EventKey.defaultFragmentKey(fragment.id);
        const initialEntries = eventCreator.nextEvents(n);
        initialEntries.forEach(e => {
            txn.timelineEvents.insert(createEventEntry(initialKey, roomId, e))
            initialKey = initialKey.nextKey();
        });
        return initialEntries;
    }

    async function assertTightLink(assert, txn, fragmentId1, fragmentId2) {
        const fragment1 = await txn.timelineFragments.get(roomId, fragmentId1);
        const fragment2 = await txn.timelineFragments.get(roomId, fragmentId2);
        assert.equal(fragment1.nextId, fragment2.id);
        assert.equal(fragment2.previousId, fragment1.id);
        assert.equal(fragment2.previousToken, null);
        assert.equal(fragment1.nextToken, null);
    }

    async function assertWeakLink(assert, txn, fragmentId1, fragmentId2) {
        const fragment1 = await txn.timelineFragments.get(roomId, fragmentId1);
        const fragment2 = await txn.timelineFragments.get(roomId, fragmentId2);
        assert.equal(fragment1.nextId, fragment2.id);
        assert.equal(fragment2.previousId, fragment1.id);
        assert.notEqual(fragment2.previousToken, null);
        assert.notEqual(fragment1.nextToken, null);
    }

    return {
        "Backfilling an empty fragment": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const emptyFragment = await createFragment(0, txn, fragmentIdComparer, { previousToken: startToken });
            const newEntry = FragmentBoundaryEntry.start(emptyFragment, fragmentIdComparer);

            const response = eventCreator.createMessagesResponse();
            await gapWriter.writeFragmentFill(newEntry, response, txn, null);

            const allEvents = await txn.timelineEvents.eventsAfter(roomId, EventKey.minKey, 100 /* fetch all */);
            for (let i = 0; i < response.chunk.length; i++) {
                const responseEvent = response.chunk.at(-i - 1);
                const storedEvent = allEvents[i];
                assert.deepEqual(responseEvent, storedEvent.event);
            }
            await txn.complete();
        },
        "Backfilling a fragment with existing entries": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const liveFragment = await createFragment(0, txn, fragmentIdComparer, { previousToken: startToken });
            const newEntry = FragmentBoundaryEntry.start(liveFragment, fragmentIdComparer);

            const initialEntries = await prefillFragment(txn, eventCreator, liveFragment, 10);

            const response = eventCreator.createMessagesResponse();
            await gapWriter.writeFragmentFill(newEntry, response, txn, null);

            const allEvents = await txn.timelineEvents.eventsAfter(roomId, EventKey.minKey, 100 /* fetch all */);
            let i = 0;
            for (; i < response.chunk.length; i++) {
                const responseEvent = response.chunk.at(-i - 1);
                const storedEvent = allEvents[i];
                assert.deepEqual(responseEvent, storedEvent.event);
            }
            for (const initialEntry of initialEntries) {
                const storedEvent = allEvents[i++];
                assert.deepEqual(initialEntry, storedEvent.event);
            }

            await txn.complete()
        },
        "Backfilling a fragment that is expected to link up, and does": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const existingFragment = await createFragment(0, txn, fragmentIdComparer, { nextId: 1, nextToken: startToken });
            const liveFragment = await createFragment(1, txn, fragmentIdComparer, { previousId: 0, previousToken: startToken });
            const newEntry = FragmentBoundaryEntry.start(liveFragment, fragmentIdComparer);

            const initialEntries = await prefillFragment(txn, eventCreator, existingFragment, 10);
            const response = eventCreator.createMessagesResponse();
            response.chunk.push(initialEntries.at(-1)); /* Expect overlap */
            await gapWriter.writeFragmentFill(newEntry, response, txn, null);

            const allEvents = await txn.timelineEvents._timelineStore.selectAll();
            let i = 0;
            for (const initialEntry of initialEntries) {
                const storedEvent = allEvents[i++];
                assert.deepEqual(initialEntry, storedEvent.event);
            }
            for (let j = 0; j < response.chunk.length - 1; j++) {
                const responseEvent = response.chunk.at(-j - 2);
                const storedEvent = allEvents[i + j];
                assert.deepEqual(responseEvent, storedEvent.event);
            }
            await assertTightLink(assert, txn, 0, 1);
        },
        "Backfilling a fragment that is expected to link up, but doesn't yet": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const existingFragment = await createFragment(0, txn, fragmentIdComparer, { nextId: 1, nextToken: endToken });
            const liveFragment = await createFragment(1, txn, fragmentIdComparer, { previousId: 0, previousToken: startToken });
            const newEntry = FragmentBoundaryEntry.start(liveFragment, fragmentIdComparer);

            const initialEntries = await prefillFragment(txn, eventCreator, existingFragment, 10);
            const response = eventCreator.createMessagesResponse();
            await gapWriter.writeFragmentFill(newEntry, response, txn, null);

            const allEvents = await txn.timelineEvents._timelineStore.selectAll();
            let i = 0;
            for (const initialEntry of initialEntries) {
                const storedEvent = allEvents[i++];
                assert.deepEqual(initialEntry, storedEvent.event);
            }
            for (let j = 0; j < response.chunk.length - 1; j++) {
                const responseEvent = response.chunk.at(-j - 1);
                const storedEvent = allEvents[i + j];
                assert.deepEqual(responseEvent, storedEvent.event);
            }
            await assertWeakLink(assert, txn, 0, 1);
        },
        "Backfilling a fragment that is not expected to link up": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const existingFragment = await createFragment(0, txn, fragmentIdComparer, { nextToken: startToken });
            const liveFragment = await createFragment(1, txn, fragmentIdComparer, { previousToken: startToken });
            const newEntry = FragmentBoundaryEntry.start(liveFragment, fragmentIdComparer);

            const initialEntries = await prefillFragment(txn, eventCreator, existingFragment, 10);
            const response = eventCreator.createMessagesResponse();
            response.chunk.push(initialEntries.at(-1)); /* Fake overlap */
            await gapWriter.writeFragmentFill(newEntry, response, txn, null);

            const allEvents = await txn.timelineEvents._timelineStore.selectAll();
            let i = 0;
            for (const initialEntry of initialEntries) {
                const storedEvent = allEvents[i++];
                assert.deepEqual(initialEntry, storedEvent.event);
            }
            for (let j = 0; j < response.chunk.length - 1; j++) {
                const responseEvent = response.chunk.at(-j - 2);
                const storedEvent = allEvents[i + j];
                assert.deepEqual(responseEvent, storedEvent.event);
            }
            await assertTightLink(assert, txn, 0, 1);
        },
        "Receiving a sync with the same events as the current fragment does not create infinite link": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const liveFragment = await createFragment(0, txn, fragmentIdComparer, { previousToken: startToken });
            const newEntry = FragmentBoundaryEntry.start(liveFragment, fragmentIdComparer);

            const initialEntries = await prefillFragment(txn, eventCreator, liveFragment, 10);
            const response = { start: startToken, end: endToken, chunk: initialEntries.slice().reverse(), state: [] };
            await gapWriter.writeFragmentFill(newEntry, response, txn, new NullLogger());

            const updatedLiveFragment = txn.timelineFragments.get(roomId, 0);
            assert.equal(updatedLiveFragment.previousId, null);
            const allEvents = await txn.timelineEvents._timelineStore.selectAll();
            let i = 0;
            for (const initialEntry of initialEntries) {
                assert.deepEqual(allEvents[i++].event, initialEntry);
            }
            assert.equal(allEvents.length, 10);
        },
        "An event received by sync does not interrupt backfilling": async assert => {
            const { txn, fragmentIdComparer, gapWriter, eventCreator } = await setup();
            const existingFragment = await createFragment(0, txn, fragmentIdComparer, { nextId: 1, nextToken: endToken });
            const liveFragment = await createFragment(1, txn, fragmentIdComparer, { previousId: 0, previousToken: startToken });
            const anotherFragment = await createFragment(2, txn, fragmentIdComparer);
            const newEntry = FragmentBoundaryEntry.start(liveFragment, fragmentIdComparer);

            const initialEntries = await prefillFragment(txn, eventCreator, existingFragment, 10);
            const [strayEntry] = await prefillFragment(txn, eventCreator, anotherFragment, 1);
            const response = eventCreator.createMessagesResponse();
            const originalEntries = response.chunk.slice();
            response.chunk.splice(response.chunk.length - 3, 0, initialEntries[5], strayEntry);
            await gapWriter.writeFragmentFill(newEntry, response, txn, null);

            const allEvents = await txn.timelineEvents._timelineStore.selectAll();
            let i = 0;
            for (const initialEntry of initialEntries) {
                const storedEvent = allEvents[i++];
                assert.deepEqual(initialEntry, storedEvent.event);
            }
            for (const originalEntry of originalEntries.reverse()) {
                const storedEvent = allEvents[i++];
                assert.deepEqual(originalEntry, storedEvent.event);
            }
            await assertWeakLink(assert, txn, 0, 1);
        },
    }
}
