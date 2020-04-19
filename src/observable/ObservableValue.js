import {AbortError} from "../utils/error.js";
import BaseObservable from "./BaseObservable.js";

// like an EventEmitter, but doesn't have an event type
export class BaseObservableValue extends BaseObservable {
    emit(argument) {
        for (const h of this._handlers) {
            h(argument);
        }
    }

}

class WaitForHandle {
    constructor(observable, predicate) {
        this._promise = new Promise((resolve, reject) => {
            this._reject = reject;
            this._subscription = observable.subscribe(v => {
                if (predicate(v)) {
                    this._reject = null;
                    resolve(v);
                    this.dispose();
                }
            });
        });
    }

    get promise() {
        return this._promise;
    }

    dispose() {
        if (this._subscription) {
            this._subscription();
            this._subscription = null;
        }
        if (this._reject) {
            this._reject(new AbortError());
            this._reject = null;
        }
    }
}

class ResolvedWaitForHandle {
    constructor(promise) {
        this.promise = promise;
    }

    dispose() {}
}

export default class ObservableValue extends BaseObservableValue {
    constructor(initialValue) {
        super();
        this._value = initialValue;
    }

    get() {
        return this._value;
    }

    set(value) {
        if (value !== this._value) {
            this._value = value;
            this.emit(this._value);
        }
    }

    waitFor(predicate) {
        if (predicate(this.get())) {
            return new ResolvedWaitForHandle(Promise.resolve(this.get()));
        } else {
            return new WaitForHandle(this, predicate);
        }
    }
}

export function tests() {
    return {
        "set emits an update": assert => {
            const a = new ObservableValue();
            let fired = false;
            const subscription = a.subscribe(v => {
                fired = true;
                assert.strictEqual(v, 5);
            });
            a.set(5);
            assert(fired);
            subscription();
        },
        "set doesn't emit if value hasn't changed": assert => {
            const a = new ObservableValue(5);
            let fired = false;
            const subscription = a.subscribe(() => {
                fired = true;
            });
            a.set(5);
            a.set(5);
            assert(!fired);
            subscription();
        },
        "waitFor promise resolves on matching update": async assert => {
            const a = new ObservableValue(5);
            const handle = a.waitFor(v => v === 6);
            Promise.resolve().then(() => {
                a.set(6);
            });
            await handle.promise;
            assert.strictEqual(a.get(), 6);
        },
        "waitFor promise rejects when disposed": async assert => {
            const a = new ObservableValue();
            const handle = a.waitFor(() => false);
            Promise.resolve().then(() => {
                handle.dispose();
            });
            await assert.rejects(handle.promise, AbortError);
        },
    }
}
