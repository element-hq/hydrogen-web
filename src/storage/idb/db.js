const SYNC_STORES = [
	"sync",
	"summary",
	"timeline",
	"members",
	"state"
];

class Database {
	constructor(idbDatabase) {
		this._db = idbDatabase;
		this._syncTxn = null;
	}

	async startSyncTxn() {
		const txn = this._db.transaction(SYNC_STORES, "readwrite");
		return new Transaction(txn, SYNC_STORES);
	}

	startReadOnlyTxn(storeName) {
		if (this._syncTxn && SYNC_STORES.includes(storeName)) {
			return this._syncTxn;
		} else {
			return this._db.transaction([storeName], "readonly");
		}
	}

	startReadWriteTxn(storeName) {
		if (this._syncTxn && SYNC_STORES.includes(storeName)) {
			return this._syncTxn;
		} else {
			return this._db.transaction([storeName], "readwrite");
		}
	}

	store(storeName) {
		return new ObjectStore(this, storeName);
	}
}

class Transaction {
	constructor(txn, allowedStoreNames) {
		this._txn = txn;
		this._stores = {
			sync: null,
			summary: null,
			timeline: null,
			state: null,
		};
		this._allowedStoreNames = allowedStoreNames;
	}

	_idbStore(name) {
		if (!this._allowedStoreNames.includes(name)) {
			throw new Error(`Invalid store for transaction: ${name}, only ${this._allowedStoreNames.join(", ")} are allowed.`);
		}
		return new ObjectStore(this._txn.getObjectStore(name));
	}

	get timeline() {
		if (!this._stores.timeline) {
			const idbStore = this._idbStore("timeline");
			this._stores.timeline = new TimelineStore(idbStore);
		}
		return this._stores.timeline;
	}

	complete() {
		return txnAsPromise(this._txn);
	}

	abort() {
		this._txn.abort();
	}
}

class QueryTarget {
	reduce(range, reducer, initialValue) {
		return this._reduce(range, reducer, initialValue, "next");
	}

	reduceReverse(range, reducer, initialValue) {
		return this._reduce(range, reducer, initialValue, "next");
	}
	
	selectLimit(range, amount) {
		return this._selectLimit(range, amount, "next");
	}

	selectLimitReverse(range, amount) {
		return this._selectLimit(range, amount, "prev");
	}

	selectWhile(range, predicate) {
		return this._selectWhile(range, predicate, "next");
	}

	selectWhileReverse(range, predicate) {
		return this._selectWhile(range, predicate, "prev");
	}

	selectAll(range) {
		const cursor = this._queryTarget().openCursor(range, direction);
		const results = [];
		return iterateCursor(cursor, (value) => {
			results.push(value);
			return true;
		});
	}

	selectFirst(range) {
		return this._find(range, () => true, "next");
	}

	selectLast(range) {
		return this._find(range, () => true, "prev");
	}

	find(range, predicate) {
		return this._find(range, predicate, "next");
	}

	findReverse(range, predicate) {
		return this._find(range, predicate, "prev");
	}

	_reduce(range, reducer, initialValue, direction) {
		let reducedValue = initialValue;
		const cursor = this._queryTarget().openCursor(range, direction);
		return iterateCursor(cursor, (value) => {
			reducedValue = reducer(reducedValue, value);
			return true;
		});
	}

	_selectLimit(range, amount, direction) {
		return this._selectWhile(range, (results) => {
			return results.length === amount;
		}, direction);
	}

	_selectWhile(range, predicate, direction) {
		const cursor = this._queryTarget().openCursor(range, direction);
		const results = [];
		return iterateCursor(cursor, (value) => {
			results.push(value);
			return predicate(results);
		});
	}

	async _find(range, predicate, direction) {
		const cursor = this._queryTarget().openCursor(range, direction);
		let result;
		const found = await iterateCursor(cursor, (value) => {
			if (predicate(value)) {
				result = value;
			}
		});
		if (!found) {
			throw new Error("not found");
		}
		return result;
	}

	_queryTarget() {
		throw new Error("override this");
	}
}

class ObjectStore extends QueryTarget {
	constructor(store) {
		this._store = store;
	}

	_queryTarget() {
		return this._store;
	}

	index(indexName) {
		return new Index(this._store.index(indexName));
	}
}

class Index extends QueryTarget {
	constructor(index) {
		this._index = index;
	}

	_queryTarget() {
		return this._index;
	}
}