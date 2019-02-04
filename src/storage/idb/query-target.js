import {iterateCursor} from "./utils";

export default class QueryTarget {
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