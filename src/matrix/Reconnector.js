export class ExponentialRetryDelay {
    constructor(start = 2000, createTimeout) {
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
            const seconds = this._current / 1000;
            const powerOfTwo = (seconds * seconds) * 1000;
            this._current = Math.max(this._max, powerOfTwo);
        } catch(err) {
            // swallow AbortError, means skipWaiting was called
            if (!(err instanceof AbortError)) {
                throw err;
            }
        } finally {
            this._timeout = null;
        }
    }

    skipWaiting() {
        if (this._timeout) {
            this._timeout.abort();
        }
    }

    reset() {
        this._current = this._start;
        this.skipWaiting();
    }

    get nextValue() {
        return this._current;
    }
}

// we need a clock interface that gives us both timestamps and a timer that we can interrupt?

// state
// - offline
// - waiting to reconnect
// - reconnecting
// - online
// 
// 

function createEnum(...values) {
    const obj = {};
    for (const value of values) {
        obj[value] = value;
    }
    return Object.freeze(obj);
}

export const ConnectionState = createEnum(
    "Offline",
    "Waiting",
    "Reconnecting",
    "Online"
);

export class Reconnector extends ObservableValue {
    constructor({retryDelay, createTimeMeasure}) {
        this._online 
        this._retryDelay = retryDelay;
        this._currentDelay = null;
        this._createTimeMeasure = createTimeMeasure;
        // assume online, and do our thing when something fails
        this._state = ConnectionState.Online;
        this._isReconnecting = false;
        this._versionsResponse = null;
    }

    get lastVersionsResponse() {
        return this._versionsResponse;
    }

    get state() {
        return this._state;
    }

    get retryIn() {
        if (this._state === ConnectionState.Waiting) {
            return this._retryDelay.nextValue - this._stateSince.measure();
        }
        return 0;
    }

    onRequestFailed(hsApi) {
        if (!this._isReconnecting) {
            this._setState(ConnectionState.Offline);
            this._reconnectLoop(hsApi);
        }
    }

    tryNow() {
        if (this._retryDelay) {
            this._retryDelay.skipWaiting();
        }
    }

    _setState(state) {
        if (state !== this._state) {
            this._state = state;
            if (this._state === ConnectionState.Waiting) {
                this._stateSince = this._createTimeMeasure();
            } else {
                this._stateSince = null;
            }
            this.emit(state);
        }
    }
    
    async _reconnectLoop(hsApi) {
        this._isReconnecting = true;
        this._versionsResponse = null;
        this._retryDelay.reset();

        while (!this._versionsResponse) {
            try {
                this._setState(ConnectionState.Reconnecting);
                // use 10s timeout, because we don't want to be waiting for
                // a stale connection when we just came online again
                const versionsRequest = hsApi.versions({timeout: 10000});
                this._versionsResponse = await versionsRequest.response();
                this._setState(ConnectionState.Online);
            } catch (err) {
                // NetworkError or AbortError from timeout
                this._setState(ConnectionState.Waiting);
                await this._retryDelay.waitForRetry();
            }
        }
    }
}
