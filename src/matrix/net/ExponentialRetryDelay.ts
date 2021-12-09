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

import {AbortError} from "../../utils/error";
import type {Timeout} from "../../platform/web/dom/Clock.js";

type TimeoutCreator = (ms: number) => Timeout;

const enum Default { start = 2000 }

export class ExponentialRetryDelay {
    private readonly _start: number = Default.start;
    private _current: number = Default.start;
    private readonly _createTimeout: TimeoutCreator;
    private readonly _max: number;
    private _timeout?: Timeout;

    constructor(createTimeout: TimeoutCreator) {
        const start = 2000;
        this._start = start;
        this._current = start;
        this._createTimeout = createTimeout;
        this._max = 60 * 5 * 1000; //5 min
    }

    async waitForRetry(): Promise<void> {
        this._timeout = this._createTimeout(this._current);
        try {
            await this._timeout.elapsed();
            // only increase delay if we didn't get interrupted
            const next = 2 * this._current;
            this._current = Math.min(this._max, next);
        } catch(err) {
            // swallow AbortError, means abort was called
            if (!(err instanceof AbortError)) {
                throw err;
            }
        } finally {
            this._timeout = undefined;
        }
    }

    abort(): void {
        if (this._timeout) {
            this._timeout.abort();
        }
    }

    reset(): void {
        this._current = this._start;
        this.abort();
    }

    get nextValue(): number {
        return this._current;
    }
}


import {Clock as MockClock} from "../../mocks/Clock.js";

export function tests() {
    return {
        "test sequence": async assert => {
            const clock = new MockClock();
            const retryDelay = new ExponentialRetryDelay(clock.createTimeout);
            let promise;

            assert.strictEqual(retryDelay.nextValue, 2000);
            promise = retryDelay.waitForRetry();
            clock.elapse(2000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 4000);
            promise = retryDelay.waitForRetry();
            clock.elapse(4000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 8000);
            promise = retryDelay.waitForRetry();
            clock.elapse(8000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 16000);
            promise = retryDelay.waitForRetry();
            clock.elapse(16000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 32000);
            promise = retryDelay.waitForRetry();
            clock.elapse(32000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 64000);
            promise = retryDelay.waitForRetry();
            clock.elapse(64000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 128000);
            promise = retryDelay.waitForRetry();
            clock.elapse(128000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 256000);
            promise = retryDelay.waitForRetry();
            clock.elapse(256000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 300000);
            promise = retryDelay.waitForRetry();
            clock.elapse(300000);
            await promise;

            assert.strictEqual(retryDelay.nextValue, 300000);
            promise = retryDelay.waitForRetry();
            clock.elapse(300000);
            await promise;
        },
    }
    
}
