import GapSortKey from "./gapsortkey";
import {select} from "./utils";

const TIMELINE_STORE = "timeline";

class TimelineStore {
	// create with transaction for sync????
	constructor(db, roomId) {
		this._db = db;
		this._roomId = roomId;
	}

	async lastEvents(amount) {
		return this.eventsBefore(GapSortKey.maxKey());
	}

	async firstEvents(amount) {
		return this.eventsAfter(GapSortKey.minKey());
	}

	eventsAfter(sortKey, amount) {
		const range = IDBKeyRange.lowerBound([this._roomId, sortKey], true);
		return this._db
			.store(TIMELINE_STORE)
			.index("by_sort_key")
			.selectLimit(range, amount);
	}

	async eventsBefore(sortKey, amount) {
		const range = IDBKeyRange.upperBound([this._roomId, sortKey], true);
		const events = await this._db
			.store(TIMELINE_STORE)
			.index("by_sort_key")
			.selectLimitReverse(range, amount);
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
	async addEvents(events) {
		const txn = this._db.startReadWriteTxn(TIMELINE_STORE);
		const timeline = txn.objectStore(TIMELINE_STORE);
		events.forEach(event => timeline.add(event));
		return txnAsPromise(txn);
	}
	// used to close gaps (gaps are also inserted as fake events)
	// delete old events and add new ones in one transaction
	async replaceEvents(oldEventIds, newEvents) {
		const txn = this._db.startReadWriteTxn(TIMELINE_STORE);
		const timeline = txn.objectStore(TIMELINE_STORE);
		oldEventIds.forEach(event_id => timeline.delete([this._roomId, event_id]));
		events.forEach(event => timeline.add(event));
		return txnAsPromise(txn);
	}
}
