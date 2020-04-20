import {ObservableValue} from "../observable/ObservableValue.js";

class Timeout {
    constructor(elapsed, ms) {
        this._reject = null;
        this._handle = null;
        const timeoutValue = elapsed.get() + ms;
        this._waitHandle = elapsed.waitFor(t => t >= timeoutValue);
    }

    elapsed() {
        return this._waitHandle.promise;
    }

    abort() {
        // will reject with AbortError
        this._waitHandle.dispose();
    }
}

class TimeMeasure {
    constructor(elapsed) {
        this._elapsed = elapsed;
        this._start = elapsed.get();
    }

    measure() {
        return this._elapsed.get() - this._start;
    }
}

export class Clock {
    constructor(baseTimestamp = 0) {
        this._baseTimestamp = baseTimestamp;
        this._elapsed = new ObservableValue(0);
        // should be callable as a function as well as a method
        this.createMeasure = this.createMeasure.bind(this);
        this.createTimeout = this.createTimeout.bind(this);
        this.now = this.now.bind(this);
    }

    createMeasure() {
        return new TimeMeasure(this._elapsed);
    }

    createTimeout(ms) {
        return new Timeout(this._elapsed, ms);
    }

    now() {
        return this._baseTimestamp + this.elapsed;
    }

    elapse(ms) {
        this._elapsed.set(this._elapsed.get() + Math.max(0, ms));
    }

    get elapsed() {
        return this._elapsed.get();
    }
}

export function tests() {
    return {
        "test timeout": async assert => {
            const clock = new Clock();
            Promise.resolve().then(() => {
                clock.elapse(500);
                clock.elapse(500);
            }).catch(assert.fail);
            const timeout = clock.createTimeout(1000);
            const promise = timeout.elapsed();
            assert(promise instanceof Promise);
            await promise;
        }
    }
}
