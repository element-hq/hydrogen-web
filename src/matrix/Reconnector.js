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

export class Reconnector {
    constructor({retryDelay, createTimeMeasure, isOnline}) {
        this._isOnline = isOnline;
        this._retryDelay = retryDelay;
        this._createTimeMeasure = createTimeMeasure;
        // assume online, and do our thing when something fails
        this._state = new ObservableValue(ConnectionState.Online);
        this._isReconnecting = false;
        this._versionsResponse = null;
    }

    get lastVersionsResponse() {
        return this._versionsResponse;
    }

    get connectionState() {
        return this._state;
    }

    get retryIn() {
        if (this._state.get() === ConnectionState.Waiting) {
            return this._retryDelay.nextValue - this._stateSince.measure();
        }
        return 0;
    }

    async onRequestFailed(hsApi) {
        if (!this._isReconnecting) {
            this._setState(ConnectionState.Offline);
    
            const isOnlineSubscription = this._isOnline && this._isOnline.subscribe(online => {
                if (online) {
                    this.tryNow();
                }
            });

            try {
                await this._reconnectLoop(hsApi);
            } finally {
                if (isOnlineSubscription) {
                    // unsubscribe from this._isOnline
                    isOnlineSubscription();
                }
            }
        }
    }

    tryNow() {
        if (this._retryDelay) {
            // this will interrupt this._retryDelay.waitForRetry() in _reconnectLoop
            this._retryDelay.abort();
        }
    }

    _setState(state) {
        if (state !== this._state.get()) {
            if (state === ConnectionState.Waiting) {
                this._stateSince = this._createTimeMeasure();
            } else {
                this._stateSince = null;
            }
            this._state.set(state);
        }
    }
    
    async _reconnectLoop(hsApi) {
        this._isReconnecting = true;
        this._versionsResponse = null;
        this._retryDelay.reset();

        try {
            while (!this._versionsResponse) {
                try {
                    this._setState(ConnectionState.Reconnecting);
                    // use 10s timeout, because we don't want to be waiting for
                    // a stale connection when we just came online again
                    const versionsRequest = hsApi.versions({timeout: 10000});
                    this._versionsResponse = await versionsRequest.response();
                    this._setState(ConnectionState.Online);
                } catch (err) {
                    if (err instanceof NetworkError) {
                        this._setState(ConnectionState.Waiting);
                        try {
                            await this._retryDelay.waitForRetry();
                        } catch (err) {
                            if (!(err instanceof AbortError)) {
                                throw err;
                            }
                        }
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err) {
            // nothing is catching the error above us,
            // so just log here
            console.err(err);
        }
    }
}
