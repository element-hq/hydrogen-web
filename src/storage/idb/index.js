import QueryTarget from "./query-target.js";

export default class Index extends QueryTarget {
	constructor(index) {
		this._index = index;
	}

	_queryTarget() {
		return this._index;
	}
}