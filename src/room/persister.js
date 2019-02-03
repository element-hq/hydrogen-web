class RoomPersister {
	constructor(roomId) {
		this._roomId = roomId;
		this._lastSortKey = null;

	}

	async loadFromStorage(storage) {
		const lastEvent = await storage.timeline.lastEvents(1);
		if (lastEvent) {
			this._lastSortKey = lastEvent.sortKey;
		} else {
			this._lastSortKey = new GapSortKey();
		}
	}

	async persistGapFill(...) {

	}

	async persistSync(roomResponse, txn) {
		// persist state
		const state = roomResponse.state;
		if (state.events) {
			const promises = state.events.map((event) => txn.state.setStateEventAt(this._lastSortKey, event));
			await Promise.all(promises);
		}

		let nextKey;
		const timeline = roomResponse.timeline;
		// is limited true for initial sync???? or do we need to handle that as a special case?
		if (timeline.limited) {
			nextKey = this._lastSortKey.nextKeyWithGap();
			txn.timeline.appendGap(this._roomId, nextKey, {prev_batch: timeline.prev_batch});
		}
		nextKey = this._lastSortKey.nextKey();

		if (timeline.events) {
			for(const event of timeline.events) {
				txn.timeline.appendEvent(this._roomId, nextKey, event);
				nextKey = nextKey.nextKey();
			}
		}
		// what happens here when the txn fails?
		this._lastSortKey = nextKey;
	}
}