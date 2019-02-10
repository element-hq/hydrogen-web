import SortKey from "../../sortkey.js";

export default class RoomTimelineStore {
	constructor(timelineStore) {
		this._timelineStore = timelineStore;
	}

	async lastEvents(roomId, amount) {
		return this.eventsBefore(roomId, SortKey.maxKey, amount);
	}

	async firstEvents(roomId, amount) {
		return this.eventsAfter(roomId, SortKey.minKey, amount);
	}

	eventsAfter(roomId, sortKey, amount) {
		const range = IDBKeyRange.lowerBound([roomId, sortKey.buffer], true);
		return this._timelineStore.selectLimit(range, amount);
	}

	async eventsBefore(roomId, sortKey, amount) {
		const range = IDBKeyRange.upperBound([roomId, sortKey.buffer], true);
		const events = await this._timelineStore.selectLimitReverse(range, amount);
		events.reverse(); // because we fetched them backwards
		return events;
	}

	// should this happen as part of a transaction that stores all synced in changes?
	// e.g.:
	// - timeline events for all rooms
	// - latest sync token
	// - new members
	// - new room state
	// - updated/new account data

	appendGap(roomId, sortKey, gap) {
		this._timelineStore.add({
			roomId: roomId,
			sortKey: sortKey.buffer,
			content: {
				event: null,
				gap: gap,
			},
		});
	}

	appendEvent(roomId, sortKey, event) {
		console.info(`appending event for room ${roomId} with key ${sortKey}`);
		this._timelineStore.add({
			roomId: roomId,
			sortKey: sortKey.buffer,
			content: {
				event: event,
				gap: null,
			},
		});
	}

	async removeEvent(roomId, sortKey) {
		this._timelineStore.delete([roomId, sortKey.buffer]);
	}
}
