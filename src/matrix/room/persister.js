import SortKey from "../storage/sortkey.js";

export default class RoomPersister {
	constructor(roomId) {
		this._roomId = roomId;
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

	// async persistGapFill(...) {

	// }

	persistSync(roomResponse, txn) {
		let nextKey = this._lastSortKey;
		const timeline = roomResponse.timeline;
        const entries = [];
		// is limited true for initial sync???? or do we need to handle that as a special case?
		// I suppose it will, yes
		if (timeline.limited) {
			nextKey = nextKey.nextKeyWithGap();
            entries.push(this._createGapEntry(nextKey, timeline.prev_batch));
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
            txn.roomTimeline.append(entry);
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

    _createGapEntry(sortKey, prevBatch) {
        return {
            roomId: this._roomId,
            sortKey: sortKey.buffer,
            event: null,
            gap: {prev_batch: prevBatch}
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
