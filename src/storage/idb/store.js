import QueryTarget from "./query-target.js";
import Index from "./index.js";

export default class Store extends QueryTarget {
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