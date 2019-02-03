import GapSortKey from "./gapsortkey";
import {select} from "./utils";

class TimelineStore {
	constructor(timelineStore) {
		this._timelineStore = timelineStore;
	}

	async lastEvents(roomId, amount) {
		return this.eventsBefore(roomId, GapSortKey.maxKey());
	}

	async firstEvents(roomId, amount) {
		return this.eventsAfter(roomId, GapSortKey.minKey());
	}

	eventsAfter(roomId, sortKey, amount) {
		const range = IDBKeyRange.lowerBound([roomId, sortKey], true);
		return this._timelineStore.selectLimit(range, amount);
	}

	async eventsBefore(roomId, sortKey, amount) {
		const range = IDBKeyRange.upperBound([roomId, sortKey], true);
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
			room_id: roomId,
			sort_key: sortKey,
			content: {
				event: null,
				gap: gap,
			},
		});
	}

	appendEvent(roomId, sortKey, event) {
		this._timelineStore.add({
			room_id: roomId,
			sort_key: sortKey,
			content: {
				event: event,
				gap: null,
			},
		});
	}

	async removeEvent(roomId, sortKey) {
		this._timelineStore.delete([roomId, sortKey]);
	}
}
