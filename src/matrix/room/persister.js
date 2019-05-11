import SortKey from "./timeline/SortKey.js";
import FragmentIndex from "./timeline/FragmentIndex.js";

function gapEntriesAreEqual(a, b) {
    if (!a || !b || !a.gap || !b.gap) {
        return false;
    }
    const gapA = a.gap, gapB = b.gap;
    return gapA.prev_batch === gapB.prev_batch && gapA.next_batch === gapB.next_batch;
}

function replaceGapEntries(roomTimeline, newEntries, gapKey, neighbourEventKey, backwards) {
    let replacedRange;
    if (neighbourEventKey) {
        replacedRange = backwards ?
            roomTimeline.boundRange(neighbourEventKey, gapKey, false, true) :
            roomTimeline.boundRange(gapKey, neighbourEventKey, true, false);
    } else {
        replacedRange = roomTimeline.onlyRange(gapKey);
    }

    const removedEntries = roomTimeline.getAndRemoveRange(this._roomId, replacedRange);
    for (let entry of newEntries) {
        roomTimeline.add(entry);
    }

    return removedEntries;
}

export default class RoomPersister {
	constructor({roomId, storage}) {
		this._roomId = roomId;
        this._storage = storage;
        // TODO: load fragmentIndex?
		this._lastSortKey = new SortKey();
		this._lastSortKey = null;
        this._fragmentIdIndex = new FragmentIdIndex([]);   //only used when timeline is loaded ... e.g. "certain" methods on this class... split up?
	}

	async load(txn) {
        const liveFragment = await txn.roomFragments.liveFragment(this._roomId);
        if (liveFragment) {
            const [lastEvent] = await txn.roomTimeline.lastEvents(this._roomId, liveFragment.id, 1);
            // last event needs to come from the fragment (e.g. passing the last fragment id)
            const lastSortKey = new SortKey(this._fragmentIdIndex);
            lastSortKey.fragmentId = liveFragment.id;
            lastSortKey.eventIndex = lastEvent.eventIndex;
            this._lastSortKey = lastSortKey;
        }
        console.log("room persister load", this._roomId, this._lastSortKey && this._lastSortKey.toString());
	}

    async persistGapFill(gapEntry, response) {
        const backwards = !!gapEntry.prev_batch;
        const {chunk, start, end} = response;
        if (!Array.isArray(chunk)) {
            throw new Error("Invalid chunk in response");
        }
        if (typeof end !== "string") {
            throw new Error("Invalid end token in response");
        }
        if ((backwards && start !== gapEntry.prev_batch) || (!backwards && start !== gapEntry.next_batch)) {
            throw new Error("start is not equal to prev_batch or next_batch");
        }
        
        const gapKey = gapEntry.sortKey;
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.roomTimeline]);
        let result;
        try {
            const roomTimeline = txn.roomTimeline;
            // make sure what we've been given is actually persisted
            // in the timeline, otherwise we're replacing something
            // that doesn't exist (maybe it has been replaced already, or ...)
            const persistedEntry = await roomTimeline.get(this._roomId, gapKey);
            if (!gapEntriesAreEqual(gapEntry, persistedEntry)) {
                throw new Error("Gap is not present in the timeline");
            }
            // find the previous event before the gap we could merge with
            const neighbourEventEntry = await (backwards ?
                roomTimeline.previousEvent(this._roomId, gapKey) :
                roomTimeline.nextEvent(this._roomId, gapKey));
            const neighbourEventId = neighbourEventEntry ? neighbourEventEntry.event.event_id : undefined;
            const {newEntries, eventFound} = this._createNewGapEntries(chunk, end, gapKey, neighbourEventId, backwards);
            const neighbourEventKey = eventFound ? neighbourEventEntry.sortKey : undefined;
            const replacedEntries = replaceGapEntries(roomTimeline, newEntries, gapKey, neighbourEventKey, backwards);
            result = {newEntries, replacedEntries};
        } catch (err) {
            txn.abort();
            throw err;
        }

        await txn.complete();

        return result;
    }

    _createNewGapEntries(chunk, nextPaginationToken, gapKey, neighbourEventId, backwards) {
        if (backwards) {
            // if backwards, the last events are the ones closest to the gap,
            // and need to be assigned a key derived from the gap first,
            // so swap order to only need one loop for both directions
            chunk.reverse();
        }
        let sortKey = gapKey;
        const {newEntries, eventFound} = chunk.reduce((acc, event) => {
            acc.eventFound = acc.eventFound || event.event_id === neighbourEventId;
            if (!acc.eventFound) {
                acc.newEntries.push(this._createEventEntry(sortKey, event));
                sortKey = backwards ? sortKey.previousKey() : sortKey.nextKey();
            }
        }, {newEntries: [], eventFound: false});

        if (!eventFound) {
            // as we're replacing an existing gap, no need to increment the gap index
            newEntries.push(this._createGapEntry(sortKey, nextPaginationToken, backwards));
        }
        if (backwards) {
            // swap resulting array order again if needed
            newEntries.reverse();
        }
        return {newEntries, eventFound};
    }

	persistSync(roomResponse, txn) {
		let nextKey = this._lastSortKey;
		const timeline = roomResponse.timeline;
        const entries = [];
		// is limited true for initial sync???? or do we need to handle that as a special case?
		// I suppose it will, yes
		if (timeline.limited) {
			nextKey = nextKey.nextKeyWithGap();
            entries.push(this._createBackwardGapEntry(nextKey, timeline.prev_batch));
        }
        if (timeline.events) {
            for(const event of timeline.events) {
                nextKey = nextKey.nextKey();
                entries.push(this._createEventEntry(nextKey, event));
			}
		}
        // write to store
        for(const entry of entries) {
            txn.roomTimeline.insert(entry);
        }
		// right thing to do? if the txn fails, not sure we'll continue anyways ...
		// only advance the key once the transaction has
		// succeeded 
		txn.complete().then(() => {
			console.log("txn complete, setting key");
			this._lastSortKey = nextKey;
		});

		// persist state
		const state = roomResponse.state;
		if (state.events) {
			for (const event of state.events) {
				txn.roomState.setStateEvent(this._roomId, event)
			}
		}

		if (timeline.events) {
			for (const event of timeline.events) {
				if (typeof event.state_key === "string") {
					txn.roomState.setStateEvent(this._roomId, event);
				}
			}
		}
        return entries;
	}

    _createBackwardGapEntry(sortKey, prevBatch) {
        return {
            roomId: this._roomId,
            sortKey: sortKey.buffer,
            event: null,
            gap: {prev_batch: prevBatch}
        };
    }

    _createForwardGapEntry(sortKey, nextBatch) {
        return {
            roomId: this._roomId,
            sortKey: sortKey.buffer,
            event: null,
            gap: {next_batch: nextBatch}
        };
    }

    _createEventEntry(sortKey, event) {
        return {
            roomId: this._roomId,
            sortKey: sortKey.buffer,
            event: event,
            gap: null
        };
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
