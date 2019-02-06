import QueryTarget from "./query-target.js";
import StoreIndex from "./store-index.js";

export default class Store extends QueryTarget {
	constructor(store) {
		this._store = store;
	}

	_queryTarget() {
		return this._store;
	}

	index(indexName) {
		return new StoreIndex(this._store.index(indexName));
	}
}