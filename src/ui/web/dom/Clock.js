import {AbortError} from "../../../utils/error.js";

class Timeout {
    constructor(ms) {
        this._reject = null;
        this._handle = null;
        this._promise = new Promise((resolve, reject) => {
            this._reject = reject;
            this._handle = setTimeout(() => {
                this._reject = null;
                resolve();
            }, ms);
        });
    }

    elapsed() {
        return this._promise;
    }

    abort() {
        if (this._reject) {
            this._reject(new AbortError());
            clearTimeout(this._handle);
            this._handle = null;
            this._reject = null;
        }
    }
}

class TimeMeasure {
    constructor() {
        this._start = window.performance.now();
    }

    measure() {
        return window.performance.now() - this._start;
    }
}

export class Clock {
    createMeasure() {
        return new TimeMeasure();
    }

    createTimeout(ms) {
        return new Timeout(ms);
    }

    now() {
        return Date.now();
    }
}
