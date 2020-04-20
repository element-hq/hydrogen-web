import Platform from "../Platform.js";
import {HomeServerError, ConnectionError} from "./error.js";

export class RateLimitingBackoff {
    constructor() {
        this._remainingRateLimitedRequest = 0;
    }

    async waitAfterLimitExceeded(retryAfterMs) {
        // this._remainingRateLimitedRequest = 5;
        // if (typeof retryAfterMs !== "number") {
        // } else {
        // }
        if (!retryAfterMs) {
            retryAfterMs = 5000;
        }
        await Platform.delay(retryAfterMs);
    }

    // do we have to know about succeeding requests?
    // we can just 

    async waitForNextSend() {
        // this._remainingRateLimitedRequest = Math.max(0, this._remainingRateLimitedRequest - 1);
    }
}

/*
this represents a slot to do one rate limited api call.
because rate-limiting is handled here, it should only
try to do one call, so the SendScheduler can safely
retry if the call ends up being rate limited.
This is also why we have this abstraction it hsApi is not
passed straight to SendQueue when it is its turn to send.
e.g. we wouldn't want to repeat the callback in SendQueue that could
have other side-effects before the call to hsApi that we wouldn't want
repeated (setting up progress handlers for file uploads,
... a UI update to say it started sending?
 ... updating storage would probably only happen once the call succeeded
 ... doing multiple hsApi calls for e.g. a file upload before sending a image message (they should individually be retried)
) maybe it is a bit overengineering, but lets stick with it for now.
At least the above is a clear definition why we have this class
*/
//class SendSlot -- obsolete

export class SendScheduler {
    constructor({hsApi, backoff}) {
        this._hsApi = hsApi;
        this._sendRequests = [];
        this._sendScheduled = false;
        this._stopped = false;
        this._waitTime = 0;
        this._backoff = backoff;
        /* 
        we should have some sort of flag here that we enable
        after all the rooms have been notified that they can resume
        sending, so that from session, we can say scheduler.enable();
        this way, when we have better scheduling, it won't be first come,
        first serve, when there are a lot of events in different rooms to send,
        but we can apply some priorization of who should go first
        */
        // this._enabled;
    }

    stop() {
        // TODO: abort current requests and set offline
    }

    start() {
        this._stopped = false;
    }

    get isStarted() {
        return !this._stopped;
    }

    // this should really be per roomId to avoid head-of-line blocking
    // 
    // takes a callback instead of returning a promise with the slot
    // to make sure the scheduler doesn't get blocked by a slot that is not consumed
    request(sendCallback) {
        let request;
        const promise = new Promise((resolve, reject) => request = {resolve, reject, sendCallback});
        this._sendRequests.push(request);
        if (!this._sendScheduled && !this._stopped) {
            this._sendLoop();
        }
        return promise;
    }

    async _sendLoop() {
        while (this._sendRequests.length) {
            const request = this._sendRequests.shift();
            let result;
            try {
                // this can throw!
                result = await this._doSend(request.sendCallback);
            } catch (err) {
                if (err instanceof ConnectionError) {
                    // we're offline, everybody will have
                    // to re-request slots when we come back online
                    this._stopped = true;
                    for (const r of this._sendRequests) {
                        r.reject(err);
                    }
                    this._sendRequests = [];
                }
                console.error("error for request", request);
                request.reject(err);
                break;
            }
            request.resolve(result);
        }
        // do next here instead of in _doSend
    }

    async _doSend(sendCallback) {
        this._sendScheduled = false;
        await this._backoff.waitForNextSend();
        // loop is left by return or throw
        while (true) { // eslint-disable-line no-constant-condition
            try {
                return await sendCallback(this._hsApi);
            } catch (err) {
                if (err instanceof HomeServerError && err.errcode === "M_LIMIT_EXCEEDED") {
                    await this._backoff.waitAfterLimitExceeded(err.retry_after_ms);
                } else {
                    throw err;
                }
            }
        }
    }
}
