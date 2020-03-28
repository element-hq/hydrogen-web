import EventKey from "../EventKey.js";
import EventEntry from "../entries/EventEntry.js";
import {createEventEntry, directionalAppend} from "./common.js";

export default class GapWriter {
    constructor({roomId, storage, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
        this._fragmentIdComparer = fragmentIdComparer;
    }
    // events is in reverse-chronological order (last event comes at index 0) if backwards
    async _findOverlappingEvents(fragmentEntry, events, txn) {
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
                    const neighbourFragment = await txn.timelineFragments.get(this._roomId, neighbourEvent.fragmentId);
                    neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment);
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

    _storeEvents(events, startKey, direction, txn) {
        const entries = [];
        // events is in reverse chronological order for backwards pagination,
        // e.g. order is moving away from the `from` point.
        let key = startKey;
        for(let event of events) {
            key = key.nextKeyForDirection(direction);
            const eventStorageEntry = createEventEntry(key, this._roomId, event);
            txn.timelineEvents.insert(eventStorageEntry);
            const eventEntry = new EventEntry(eventStorageEntry, this._fragmentIdComparer);
            directionalAppend(entries, eventEntry, direction);
        }
        return entries;
    }

    async _updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn) {
        const {direction} = fragmentEntry;
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

            // update fragmentIdComparer here after linking up fragments
            this._fragmentIdComparer.add(fragmentEntry.fragment);
            this._fragmentIdComparer.add(neighbourFragmentEntry.fragment);
        } else {
            fragmentEntry.token = end;
        }
        txn.timelineFragments.update(fragmentEntry.fragment);
    }

    async writeFragmentFill(fragmentEntry, response, txn) {
        const {fragmentId, direction} = fragmentEntry;
        // chunk is in reverse-chronological order when backwards
        const {chunk, start, end} = response;
        let entries;

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
        // find last event in fragment so we get the eventIndex to begin creating keys at
        let lastKey = await this._findFragmentEdgeEventKey(fragmentEntry, txn);
        // find out if any event in chunk is already present using findFirstOrLastOccurringEventId
        const {
            nonOverlappingEvents,
            neighbourFragmentEntry
        } = await this._findOverlappingEvents(fragmentEntry, chunk, txn);

        // create entries for all events in chunk, add them to entries
        entries = this._storeEvents(nonOverlappingEvents, lastKey, direction, txn);
        await this._updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn);
    
        return entries;
    }
}

//#ifdef TESTS
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
//#endif
