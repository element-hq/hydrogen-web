import EventEmitter from "./event-emitter.js";

class LiveMap {
	constructor() {
		this._handlers = new Set();
	}

	emitReset() {
		for(let h of this._handlers) {
			h.onReset();
		}
	}
	// we need batch events, mostly on index based collection though?
	// maybe we should get started without?
	emitAdd(key, value) {
		for(let h of this._handlers) {
			h.onAdd(key, value);
		}
	}

	emitChange(key, value, ...params) {
		for(let h of this._handlers) {
			h.onChange(key, value, ...params);
		}
	}

	emitRemove(key, value) {
		for(let h of this._handlers) {
			h.onRemove(key, value);
		}
	}

	subscribe(handler) {
		this._handlers.add(handler);
		return () => {
			if (handler) {
				this._handlers.delete(this._handler);
				handler = null;
			}
			return null;
		};
	}

	[Symbol.iterator]() {

	}
}

class Operator extends LiveMap {
	constructor(source) {
		super();
		this._source = source;
	}

	subscribe(handler) {
		this.onSubscribe(this._source);
		let subscription = super.subscribe(handler);
		let sourceSubscription = this._source.subscribe(this);
		return () => {
			sourceSubscription = sourceSubscription && sourceSubscription();
			subscription = subscription && subscription();
			// this.onUnsubscribe(); ?
			return null;
		};
	}

	onSubscribe() {

	}

	onRemove(key, value) {}
	onAdd(key, value) {}
	onChange(key, value, params) {}
	onReset() {}
}

export default class LiveMapCollection extends LiveMap {
	constructor(initialValues) {
		super();
		this._values = new Map(initialValues);
	}

	updated(key, params) {
		const value = this._values.get(key);
		if (value !== undefined) {
			this._values.add(key, value);
			this.emitChange(key, value, params);
			return true;
		}
		return false;	// or return existing value?
	}

	add(key, value) {
		if (!this._values.has(key)) {
			this._values.add(key, value);
			this.emitAdd(key, value);
			return true;
		}
		return false;	// or return existing value?
	}

	remove(key) {
		const value = this._values.get(key);
		if (value !== undefined) {
			this._values.delete(key);
			this.emitRemove(key, value);
			return true;
		} else {
			return false;
		}
	}

	reset() {
		this._values.clear();
		this.emitReset();
	}

	get(key) {
		return this._values.get(key);
	}

	[Symbol.iterator]() {
		return this._values.entries()[Symbol.iterator];
	}
}

class LiveMapOperator extends Operator {
	constructor(source, mapper, updater) {
		super(source);
		this._mapper = mapper;
		this._updater = updater;
		this._mappedValues = new Map();
	}

	onSubscribe(source) {
		for (let [key, value] of source) {
			const mappedValue = this._mapper(value);
			this._mappedValues.set(key, mappedValue);
		}
	}

	onAdd(key, value) {
		const mappedValue = this._mapper(value);
		this._mappedValues.set(key, mappedValue);
		this.emitAdd(key, mappedValue);
	}

	onRemove(key, _value) {
		const mappedValue = this._mappedValues.get(key);
		if (this._mappedValues.delete(key)) {
			this.emitRemove(key, mappedValue);
		}
	}

	onChange(key, value, params) {
		const mappedValue = this._mappedValues.get(key);
		if (mappedValue !== undefined) {
			const newParams = this._updater(value, params);
			if (newParams !== undefined) {
				this.emitChange(key, mappedValue, newParams);
			}
		}
	}

	onReset() {
		this._mappedValues.clear();
		this.emitReset();
	}

	[Symbol.iterator]() {
		return this._mappedValues.entries()[Symbol.iterator];
	}
}

class FilterOperator extends LiveMapOperator {

}

class SortSet {
	constructor(liveMap) {

	}
}

export function tests() {
	return {
		test_for_of(assert) {

		},
	};
}