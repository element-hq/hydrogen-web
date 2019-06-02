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
        const eventIds = events.map(e => e.event_id);
        let nonOverlappingEvents = events;
        let neighbourFragmentEntry;
        const neighbourEventId = await txn.timelineEvents.findFirstOccurringEventId(this._roomId, eventIds);
        if (neighbourEventId) {
            // trim overlapping events
            const neighbourEventIndex = events.findIndex(e => e.event_id === neighbourEventId);
            nonOverlappingEvents = events.slice(0, neighbourEventIndex);
            // get neighbour fragment to link it up later on
            const neighbourEvent = await txn.timelineEvents.getByEventId(this._roomId, neighbourEventId);
            const neighbourFragment = await txn.timelineFragments.get(this._roomId, neighbourEvent.fragmentId);
            neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment);
        }
        return {nonOverlappingEvents, neighbourFragmentEntry};
    }

    async _findLastFragmentEventKey(fragmentEntry, txn) {
        const {fragmentId, direction} = fragmentEntry;
        if (direction.isBackward) {
            const [firstEvent] = await txn.timelineEvents.firstEvents(this._roomId, fragmentId, 1);
            return new EventKey(firstEvent.fragmentId, firstEvent.eventIndex);
        } else {
            const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);
            return new EventKey(lastEvent.fragmentId, lastEvent.eventIndex);
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
            fragmentEntry.linkedFragmentId = neighbourFragmentEntry.fragmentId;
            neighbourFragmentEntry.linkedFragmentId = fragmentEntry.fragmentId;
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

    async writeFragmentFill(fragmentEntry, response) {
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

        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ]);

        try {
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
            let lastKey = await this._findLastFragmentEventKey(fragmentEntry, txn);
            // find out if any event in chunk is already present using findFirstOrLastOccurringEventId
            const {
                nonOverlappingEvents,
                neighbourFragmentEntry
            } = await this._findOverlappingEvents(fragmentEntry, chunk, txn);

            // create entries for all events in chunk, add them to entries
            entries = this._storeEvents(nonOverlappingEvents, lastKey, direction, txn);
            await this._updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn);
        } catch (err) {
            txn.abort();
            throw err;
        }

        await txn.complete();

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
