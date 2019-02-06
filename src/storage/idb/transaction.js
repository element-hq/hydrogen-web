import {txnAsPromise} from "./utils";
import Store from "./store.js";
import TimelineStore from "./stores/timeline.js";

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
		return new Store(this._txn.getObjectStore(name));
	}

	get roomTimeline() {
		if (!this._stores.roomTimeline) {
			const idbStore = this._idbStore("roomTimeline");
			this._stores.roomTimeline = new TimelineStore(idbStore);
		}
		return this._stores.roomTimeline;
	}

	complete() {
		return txnAsPromise(this._txn);
	}

	abort() {
		this._txn.abort();
	}
}