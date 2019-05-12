import EventKey from "../EventKey.js";
import EventEntry from "../entries/EventEntry.js";
import {createEventEntry} from "./common.js";

function directionalAppend(array, value, direction) {
    if (direction.isForward) {
        array.push(value);
    } else {
        array.splice(0, 0, value);
    }
}

export default class GapPersister {
    constructor({roomId, storage, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
        this._fragmentIdComparer = fragmentIdComparer;
    }
    async persistFragmentFill(fragmentEntry, response) {
        const {fragmentId, direction} = fragmentEntry;
        // assuming that chunk is in chronological order when backwards too?
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
            const fragment = await txn.timelineFragments.get(fragmentId);
            if (!fragment) {
                throw new Error(`Unknown fragment: ${fragmentId}`);
            }
            fragmentEntry = fragmentEntry.withUpdatedFragment(fragment);
            // check that the request was done with the token we are aware of (extra care to avoid timeline corruption)
            if (fragmentEntry.token !== start) {
                throw new Error("start is not equal to prev_batch or next_batch");
            }
            // find last event in fragment so we get the eventIndex to begin creating keys at
            let currentKey;
            if (direction.isBackward) {
                const [firstEvent] = await txn.timelineEvents.firstEvents(this._roomId, fragmentId, 1);
                currentKey = new EventKey(firstEvent.fragmentId, firstEvent.eventIndex);
            } else {
                const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);
                currentKey = new EventKey(lastEvent.fragmentId, lastEvent.eventIndex);
            }
            // find out if any event in chunk is already present using findFirstOrLastOccurringEventId
            const eventIds = chunk.map(e => e.event_id);
            const findLast = direction.isBackward;
            let nonOverlappingEvents = chunk;
            let neighbourFragmentEntry;
            const neighbourEventId = await txn.timelineEvents.findFirstOrLastOccurringEventId(this._roomId, eventIds, findLast);
            if (neighbourEventId) {
                // trim overlapping events
                const neighbourEventIndex = chunk.findIndex(e => e.event_id === neighbourEventId);
                const start = direction.isBackward ? neighbourEventIndex + 1 : 0;
                const end = direction.isBackward ? chunk.length : neighbourEventIndex;
                nonOverlappingEvents = chunk.slice(start, end);
                // get neighbour fragment to link it up later on
                const neighbourEvent = await txn.timelineEvents.getByEventId(this._roomId, neighbourEventId);
                const neighbourFragment = await txn.timelineFragments.get(neighbourEvent.fragmentId);
                neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment);
            }

            // create entries for all events in chunk, add them to entries
            entries = new Array(nonOverlappingEvents.length);
            const reducer = direction.isBackward ? Array.prototype.reduceRight : Array.prototype.reduce;
            currentKey = reducer.call(nonOverlappingEvents, (key, event, i) => {
                key = key.nextKeyForDirection(direction);
                const eventEntry = createEventEntry(currentKey, event);
                txn.timelineEvents.insert(eventEntry);
                entries[i] = new EventEntry(eventEntry, this._fragmentIdComparer);
            }, currentKey);

            directionalAppend(entries, fragmentEntry, direction);
            // set `end` as token, and if we found an event in the step before, link up the fragments in the fragment entry
            if (neighbourFragmentEntry) {
                fragmentEntry.linkedFragmentId = neighbourFragmentEntry.fragmentId;
                neighbourFragmentEntry.linkedFragmentId = fragmentEntry.fragmentId;
                txn.timelineFragments.set(neighbourFragmentEntry.fragment);
                directionalAppend(entries, neighbourFragmentEntry, direction);

                // update fragmentIdComparer here after linking up fragments?
                this._fragmentIdComparer.rebuild(await txn.timelineFragments.all());
            }
            fragmentEntry.token = end;
            txn.timelineFragments.set(fragmentEntry.fragment);
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
