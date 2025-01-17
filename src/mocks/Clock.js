/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ObservableValue} from "../observable/value";

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

class Interval {
    constructor(elapsed, ms, callback) {
        this._start = elapsed.get();
        this._last = this._start;
        this._interval = ms;
        this._callback = callback;
        this._subscription = elapsed.subscribe(this._update.bind(this));
    }

    _update(elapsed) {
        const prevAmount = Math.floor((this._last - this._start) / this._interval);
        const newAmount = Math.floor((elapsed - this._start) / this._interval);
        const amountDiff = Math.max(0, newAmount - prevAmount);
        this._last = elapsed;

        for (let i = 0; i < amountDiff; ++i) {
            this._callback();
        }
    }

    dispose() {
        if (this._subscription) {
            this._subscription();
            this._subscription = null;
        }
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

    createInterval(callback, ms) {
        return new Interval(this._elapsed, ms, callback);
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
        },
        "test interval": assert => {
            const clock = new Clock();
            let counter = 0;
            const interval = clock.createInterval(() => counter += 1, 200);
            clock.elapse(150);
            assert.strictEqual(counter, 0);
            clock.elapse(500);
            assert.strictEqual(counter, 3);
            interval.dispose();
        }
    }
}
