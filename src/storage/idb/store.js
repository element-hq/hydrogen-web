import QueryTarget from "./query-target.js";
import { reqAsPromise } from "./utils.js";

export default class Store extends QueryTarget {
	constructor(store) {
		super(store);
	}

	get _store() {
		return this._target;
	}

	index(indexName) {
		return new QueryTarget(this._store.index(indexName));
	}

	put(value) {
		return reqAsPromise(this._store.put(value));
	}

	add(value) {
		return reqAsPromise(this._store.add(value));
	}
}