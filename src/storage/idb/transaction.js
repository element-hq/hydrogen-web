import {txnAsPromise} from "./utils.js";
import Store from "./store.js";
// import TimelineStore from "./stores/timeline.js";
import SessionStore from "./stores/session.js";

export default class Transaction {
	constructor(txn, allowedStoreNames) {
		this._txn = txn;
		this._allowedStoreNames = allowedStoreNames;
		this._stores = {
			session: null,
			roomSummary: null,
			roomTimeline: null,
			roomState: null,
		};
	}

	_idbStore(name) {
		if (!this._allowedStoreNames.includes(name)) {
			// more specific error? this is a bug, so maybe not ...
			throw new Error(`Invalid store for transaction: ${name}, only ${this._allowedStoreNames.join(", ")} are allowed.`);
		}
		return new Store(this._txn.objectStore(name));
	}

	_store(name, mapStore) {
		if (!this._stores[name]) {
			const idbStore = this._idbStore(name);
			this._stores[name] = mapStore(idbStore);
		}
		return this._stores[name];
	}

	// get roomTimeline() {
	// 	return this._store("roomTimeline", idbStore => new TimelineStore(idbStore));
	// }

	get session() {
		return this._store("session", idbStore => new SessionStore(idbStore));
	}

	complete() {
		return txnAsPromise(this._txn);
	}

	abort() {
		this._txn.abort();
	}
}