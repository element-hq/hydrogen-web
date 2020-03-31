class Clock {
    // use cases
    // StopWatch: not sure I like that name ... but measure time difference from start to current time
    // Timeout: wait for a given number of ms, and be able to interrupt the wait
    //  Clock.timeout() -> creates a new timeout?
    // Now: get current timestamp
    //  Clock.now(), or pass Clock.now so others can do now()
    // 
    // should use subinterfaces so we can only pass part needed to other constructors
    // 
}


// need to prevent memory leaks here!
export class DomOnlineDetected {
    constructor(reconnecter) {
        // window.addEventListener('offline', () => appendOnlineStatus(false));
        // window.addEventListener('online', () => appendOnlineStatus(true));
        // appendOnlineStatus(navigator.onLine);
        // on online, reconnecter.tryNow()
    }
}

export class ExponentialRetryDelay {
    constructor(start = 2000, delay) {
        this._start = start;
        this._current = start;
        this._delay = delay;
        this._max = 60 * 5 * 1000; //5 min
        this._timer = null;
    }

    async waitForRetry() {
        this._timer = this._delay(this._current);
        try {
            await this._timer.timeout();
            // only increase delay if we didn't get interrupted
            const seconds = this._current / 1000;
            const powerOfTwo = (seconds * seconds) * 1000;
            this._current = Math.max(this._max, powerOfTwo);
        } finally {
            this._timer = null;
        }
    }

    reset() {
        this._current = this._start;
        if (this._timer) {
            this._timer.abort();
        }
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

export class Reconnecter {
    constructor({hsApi, retryDelay, clock}) {
        this._online 
        this._retryDelay = retryDelay;
        this._currentDelay = null;
        this._hsApi = hsApi;
        this._clock = clock;
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
        return  this._stateSince.measure();
    }

    onRequestFailed() {
        if (!this._isReconnecting) {
            this._setState(ConnectionState.Offline);
            // do something with versions response of loop here?
            // we might want to pass it to session to know what server supports?
            // so emit it ...
            this._reconnectLoop();
            // start loop
        }
    }

    // don't throw from here
    tryNow() {
        // skip waiting
        if (this._currentDelay) {
            this._currentDelay.abort();
        }
    }

    _setState(state) {
        if (state !== this._state) {
            this._state = state;
            if (this._state === ConnectionState.Waiting) {
                this._stateSince = this._clock.stopwatch();
            } else {
                this._stateSince = null;
            }
            this.emit("change", state);
        }
    }
    
    async _reconnectLoop() {
        this._isReconnecting = true;
        this._retryDelay.reset();
        this._versionsResponse = null;

        while (!this._versionsResponse) {
            // TODO: should we wait first or request first?
            // as we've just failed a request? I guess no harm in trying immediately
            try {
                this._setState(ConnectionState.Reconnecting);
                const versionsRequest = this._hsApi.versions(10000);
                this._versionsResponse = await versionsRequest.response();
                this._setState(ConnectionState.Online);
            } catch (err) {
                this._setState(ConnectionState.Waiting);
                this._currentDelay = this._retryDelay.next();
                try {
                    await this._currentDelay
                } catch (err) {
                    // waiting interrupted, we should retry immediately,
                    // swallow error
                } finally {
                    this._currentDelay = null;
                }
            }
        }
    }
}
