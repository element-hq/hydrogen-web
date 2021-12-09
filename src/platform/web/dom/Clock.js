/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
