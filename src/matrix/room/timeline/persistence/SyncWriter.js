import EventKey from "../EventKey.js";
import EventEntry from "../entries/EventEntry.js";
import FragmentBoundaryEntry from "../entries/FragmentBoundaryEntry.js";
import {createEventEntry} from "./common.js";

export default class SyncWriter {
    constructor({roomId, storage, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
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
        const oldFragment = await txn.timelineFragments.get(oldFragmentId);
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
        this._fragmentIdComparer.add(newFragment);
        return {oldFragment, newFragment};
    }

    async writeSync(roomResponse, txn) {
        const entries = [];
        const timeline = roomResponse.timeline;
        if (!this._lastLiveKey) {
            // means we haven't synced this room yet (just joined or did initial sync)
            
            // as this is probably a limited sync, prev_batch should be there
            // (but don't fail if it isn't, we won't be able to back-paginate though)
            let liveFragment = await this._createLiveFragment(txn, timeline.prev_batch);
            this._lastLiveKey = new EventKey(liveFragment.id, EventKey.defaultLiveKey.eventIndex);
            entries.push(FragmentBoundaryEntry.start(liveFragment, this._fragmentIdComparer));
        } else if (timeline.limited) {
            // replace live fragment for limited sync, *only* if we had a live fragment already
            const oldFragmentId = this._lastLiveKey.fragmentId;
            this._lastLiveKey = this._lastLiveKey.nextFragmentKey();
            const {oldFragment, newFragment} = this._replaceLiveFragment(oldFragmentId, this._lastLiveKey.fragmentId, timeline.prev_batch, txn);
            entries.push(FragmentBoundaryEntry.end(oldFragment, this._fragmentIdComparer));
            entries.push(FragmentBoundaryEntry.start(newFragment, this._fragmentIdComparer));
        }
        let currentKey = this._lastLiveKey;
        if (timeline.events) {
            for(const event of timeline.events) {
                currentKey = currentKey.nextKey();
                const entry = createEventEntry(currentKey, this._roomId, event);
                txn.timelineEvents.insert(entry);
                entries.push(new EventEntry(entry, this._fragmentIdComparer));
            }
        }
        // right thing to do? if the txn fails, not sure we'll continue anyways ...
        // only advance the key once the transaction has succeeded 
        txn.complete().then(() => {
            this._lastLiveKey = currentKey;
        })

        // persist state
        const state = roomResponse.state;
        if (state.events) {
            for (const event of state.events) {
                txn.roomState.setStateEvent(this._roomId, event)
            }
        }
        // persist live state events in timeline
        if (timeline.events) {
            for (const event of timeline.events) {
                if (typeof event.state_key === "string") {
                    txn.roomState.setStateEvent(this._roomId, event);
                }
            }
        }

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
