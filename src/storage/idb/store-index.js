import QueryTarget from "./query-target.js";

export default class StoreIndex extends QueryTarget {
	constructor(index) {
		this._index = index;
	}

	_queryTarget() {
		return this._index;
	}
}