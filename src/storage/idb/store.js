import QueryTarget from "./query-target.js";
import { reqAsPromise } from "./utils.js";

export default class Store extends QueryTarget {
	constructor(idbStore) {
		super(idbStore);
	}

	get _idbStore() {
		return this._target;
	}

	index(indexName) {
		return new QueryTarget(this._idbStore.index(indexName));
	}

	put(value) {
		return reqAsPromise(this._idbStore.put(value));
	}

	add(value) {
		return reqAsPromise(this._idbStore.add(value));
	}
}