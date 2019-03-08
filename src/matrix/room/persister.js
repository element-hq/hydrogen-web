import SortKey from "../storage/sortkey.js";

function gapEntriesAreEqual(a, b) {
    if (!a || !b || !a.gap || !b.gap) {
        return false;
    }
    const gapA = a.gap, gapB = b.gap;
    return gapA.prev_batch === gapB.prev_batch && gapA.next_batch === gapB.next_batch;
}

export default class RoomPersister {
	constructor({roomId, storage}) {
		this._roomId = roomId;
        this._storage = storage;
		this._lastSortKey = new SortKey();
	}

	async load(txn) {
		//fetch key here instead?
		const [lastEvent] = await txn.roomTimeline.lastEvents(this._roomId, 1);
		if (lastEvent) {
			this._lastSortKey = new SortKey(lastEvent.sortKey);
			console.log("room persister load", this._roomId, this._lastSortKey.toString());
		} else {
			console.warn("could not recover last sort key for ", this._roomId);
		}
	}

	async persistGapFill(gapEntry, response) {
        const {chunk, start, end} = response;
        if (!Array.isArray(chunk)) {
            throw new Error("Invalid chunk in response");
        }
        if (typeof start !== "string" || typeof end !== "string") {
            throw new Error("Invalid start or end token in response");
        }
        const gapKey = gapEntry.sortKey;
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.roomTimeline]);
        try {
            const roomTimeline = txn.roomTimeline;
            // make sure what we've been given is actually persisted
            // in the timeline, otherwise we're replacing something
            // that doesn't exist (maybe it has been replaced already, or ...)
            const persistedEntry = await roomTimeline.findEntry(this._roomId, gapKey);
            if (!gapEntriesAreEqual(gapEntry, persistedEntry)) {
                throw new Error("Gap is not present in the timeline");
            }
            // find the previous event before the gap we could blend with
            const backwards = !!gapEntry.prev_batch;
            let neighbourEventEntry;
            if (backwards) {
                neighbourEventEntry = await roomTimeline.previousEventFromGap(this._roomId, gapKey);
            } else {
                neighbourEventEntry = await roomTimeline.nextEventFromGap(this._roomId, gapKey);
            }
            const neighbourEvent = neighbourEventEntry && neighbourEventEntry.event;

            const newEntries = [];
            let sortKey = gapKey;
            let eventFound = false;
            if (backwards) {
                for (let i = chunk.length - 1; i >= 0; i--) {
                    const event = chunk[i];
                    if (event.id === neighbourEvent.id) {
                        eventFound = true;
                        break;
                    }
                    newEntries.splice(0, 0, this._createEventEntry(sortKey, event));
                    sortKey = sortKey.previousKey();
                }
                if (!eventFound) {
                    newEntries.splice(0, 0, this._createBackwardGapEntry(sortKey, end));
                }
            } else {
                for (let i = 0; i < chunk.length; i++) {
                    const event = chunk[i];
                    if (event.id === neighbourEvent.id) {
                        eventFound = true;
                        break;
                    }
                    newEntries.push(this._createEventEntry(sortKey, event));
                    sortKey = sortKey.nextKey();
                }
                if (!eventFound) {
                    // need to check start is correct here
                    newEntries.push(this._createForwardGapEntry(sortKey, start));
                }
            }

            if (eventFound) {
                // remove gap on the other side as well,
                // or while we're at it, remove all gaps between gapKey and neighbourEventEntry.sortKey
            } else {
                roomTimeline.deleteEntry(this._roomId, gapKey);
            }

            for (let entry of newEntries) {
                roomTimeline.add(entry);
            }
        } catch (err) {
            txn.abort();
            throw err;
        }

        await txn.complete();

        // somehow also return all the gaps we removed so the timeline can do the same
        return {newEntries};
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
        // const startOfChunkSortKey = nextKey;
        if (timeline.events) {
            for(const event of timeline.events) {
                nextKey = nextKey.nextKey();
                entries.push(this._createEventEntry(nextKey, event));
			}
		}
        // write to store
        for(const entry of entries) {
            txn.roomTimeline.add(entry);
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
