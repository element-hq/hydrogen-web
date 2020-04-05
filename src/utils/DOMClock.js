import {AbortError} from "./error.js";

class DOMTimeout {
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

class DOMTimeMeasure {
    constructor() {
        this._start = window.performance.now();
    }

    measure() {
        return window.performance.now() - this._start;
    }
}

export class DOMClock {
    createMeasure() {
        return new DOMTimeMeasure();
    }

    createTimeout(ms) {
        return new DOMTimeout(ms);
    }

    now() {
        return Date.now();
    }
}
