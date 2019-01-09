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

	startSyncTxn() {
		if (this._syncTxn) {
			return txnAsPromise(this._syncTxn);
		}
		this._syncTxn = this._db.transaction(SYNC_STORES, "readwrite");
		this._syncTxn.addEventListener("complete", () => this._syncTxn = null);
		this._syncTxn.addEventListener("abort", () => this._syncTxn = null);
		return txnAsPromise(this._syncTxn);
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
		const cursor = this._getIdbQueryTarget().openCursor(range, direction);
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
		const cursor = this._getIdbQueryTarget().openCursor(range, direction);
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
		const cursor = this._getIdbQueryTarget().openCursor(range, direction);
		const results = [];
		return iterateCursor(cursor, (value) => {
			results.push(value);
			return predicate(results);
		});
	}

	async _find(range, predicate, direction) {
		const cursor = this._getIdbQueryTarget().openCursor(range, direction);
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

	_getIdbQueryTarget() {
		throw new Error("override this");
	}
}

class ObjectStore extends QueryTarget {
	constructor(db, storeName) {
		this._db = db;
		this._storeName = storeName;
	}

	_getIdbQueryTarget() {
		this._db
			.startReadOnlyTxn(this._storeName)
			.getObjectStore(this._storeName);
	}

	_readWriteTxn() {
		this._db
			.startReadWriteTxn(this._storeName)
			.getObjectStore(this._storeName);
	}

	index(indexName) {
		return new Index(this._db, this._storeName, indexName);
	}
}

class Index extends QueryTarget {
	constructor(db, storeName, indexName) {
		this._db = db;
		this._storeName = storeName;
		this._indexName = indexName;
	}

	_getIdbQueryTarget() {
		this._db
			.startReadOnlyTxn(this._storeName)
			.getObjectStore(this._storeName)
			.index(this._indexName);
	}
}