/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {AbortError} from "../../../utils/error";

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

    dispose() {
        this.abort();
    }
}

class Interval {
    constructor(ms, callback) {
        this._handle = setInterval(callback, ms);
    }

    dispose() {
        if (this._handle) {
            clearInterval(this._handle);
            this._handle = null;
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

    createInterval(callback, ms) {
        return new Interval(ms, callback);
    }

    now() {
        return Date.now();
    }
}
