export default class EventEmitter {
	constructor() {
		this._handlersByName = {};
	}

	emit(name, ...values) {
		const handlers = this._handlersByName[name];
		if (handlers) {
			for(const h of handlers) {
				h(...values);
			}
		}
	}

	on(name, callback) {
		let handlers = this._handlersByName[name];
		if (!handlers) {
            this.onFirstSubscriptionAdded(name);
			this._handlersByName[name] = handlers = new Set();
		}
		handlers.add(callback);
	}

	off(name, callback) {
		const handlers = this._handlersByName[name];
		if (handlers) {
			handlers.delete(callback);
			if (handlers.length === 0) {
				delete this._handlersByName[name];
                this.onLastSubscriptionRemoved(name);
			}
		}
	}

    onFirstSubscriptionAdded(name) {}

    onLastSubscriptionRemoved(name) {}
}
//#ifdef TESTS
export function tests() {
	return {
		test_on_off(assert) {
			let counter = 0;
			const e = new EventEmitter();
			const callback = () => counter += 1;
			e.on("change", callback);
			e.emit("change");
			e.off("change", callback);
			e.emit("change");
			assert.equal(counter, 1);
		},

		test_emit_value(assert) {
			let value = 0;
			const e = new EventEmitter();
			const callback = (v) => value = v;
			e.on("change", callback);
			e.emit("change", 5);
			e.off("change", callback);
			assert.equal(value, 5);
		},

		test_double_on(assert) {
			let counter = 0;
			const e = new EventEmitter();
			const callback = () => counter += 1;
			e.on("change", callback);
			e.on("change", callback);
			e.emit("change");
			e.off("change", callback);
			assert.equal(counter, 1);
		}
	};
}
//#endif
