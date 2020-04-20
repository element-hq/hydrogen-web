import {AbortError} from "../../utils/error.js";

export default class ExponentialRetryDelay {
    constructor(createTimeout, start = 2000) {
        this._start = start;
        this._current = start;
        this._createTimeout = createTimeout;
        this._max = 60 * 5 * 1000; //5 min
        this._timeout = null;
    }

    async waitForRetry() {
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
            this._timeout = null;
        }
    }

    abort() {
        if (this._timeout) {
            this._timeout.abort();
        }
    }

    reset() {
        this._current = this._start;
        this.abort();
    }

    get nextValue() {
        return this._current;
    }
}


import MockClock from "../../mocks/Clock.js";

export function tests() {
    return {
        "test sequence": async assert => {
            const clock = new MockClock();
            const retryDelay = new ExponentialRetryDelay(clock.createTimeout, 2000);
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
