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
                    // TODO: check here that the neighbourEvent is at the correct edge of it's fragment
                    // get neighbour fragment to link it up later on
                    const neighbourEvent = await txn.timelineEvents.getByEventId(this._roomId, duplicateEventId);
                    if (neighbourEvent.fragmentId === fragmentEntry.fragmentId) {
                        log.log("hit #160, prevent fragment linking to itself", log.level.Warn);
                    } else {
                        const neighbourFragment = await txn.timelineFragments.get(this._roomId, neighbourEvent.fragmentId);
                        neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment);
                    }
                    // trim overlapping events
                    remainingEvents = null;
                } else {
                    // we've hit https://github.com/matrix-org/synapse/issues/7164, 
                    // e.g. the event id we found is already in our store but it is not
                    // the adjacent fragment id. Ignore the event, but keep processing the ones after.
                    remainingEvents = remainingEvents.slice(duplicateEventIndex + 1);
                }
            } else {
                nonOverlappingEvents.push(...remainingEvents);
                remainingEvents = null;
            }
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
