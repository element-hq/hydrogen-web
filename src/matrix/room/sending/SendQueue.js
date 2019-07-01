import Platform from "../../../Platform.js";

class RateLimitingBackoff {
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
        Platform.delay(1000);
    }
}

class SendScheduler {
    constructor({hsApi, backoff}) {
        this._hsApi = hsApi;
        this._slotRequests = [];
        this._sendScheduled = false;
        this._offline = false;
        this._waitTime = 0;
        this._backoff = backoff;
    }

    // this should really be per roomId to avoid head-of-line blocking
    // 
    // takes a callback instead of returning a promise with the slot
    // to make sure the scheduler doesn't get blocked by a slot that is not consumed
    runSlot(slotCallback) {
        let request;
        const promise = new Promise((resolve, reject) => request = {resolve, reject, slotCallback});
        this._slotRequests.push(request);
        if (!this._sendScheduled && !this._offline) {
            this._sendLoop();
        }
        return promise;
    }

    async _sendLoop() {
        while (this._slotRequests.length) {
            const request = this._slotRequests.unshift();
            this._currentSlot = new SendSlot(this);
            // this can throw!
            let result;
            try {
                result = await request.slotCallback(this._currentSlot);
            } catch (err) {
                if (err instanceof NetworkError) {
                    // we're offline, everybody will have
                    // to re-request slots when we come back online
                    this._offline = true;
                    for (const r of this._slotRequests) {
                        r.reject(err);
                    }
                    this._slotRequests = [];
                }
                request.reject(err);
                break;
            }
            request.resolve(result);
        }
        // do next here instead of in _doSend
    }

    async _doSend(slot, sendCallback) {
        this._sendScheduled = false;
        if (slot !== this._currentSlot) {
            throw new Error("Slot is not active");
        }
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
class SendSlot {
    constructor(scheduler) {
        this._scheduler = scheduler;
    }

    sendContentEvent(pendingEvent) {
        return this._scheduler._doSend(this, async hsApi => {
            const request = hsApi.send(
                pendingEvent.roomId,
                pendingEvent.eventType,
                pendingEvent.txnId,
                pendingEvent.content
            );
            const response = await request.response();
            return response.event_id;
        });
    }

    sendRedaction(pendingEvent) {
        return this._scheduler._doSend(this, async hsApi => {
            const request = hsApi.redact(
                pendingEvent.roomId,
                pendingEvent.redacts,
                pendingEvent.txnId,
                pendingEvent.reason
            );
            const response = await request.response();
            return response.event_id;
        });
    }

    // progressCallback should report the amount of bytes sent
    uploadMedia(fileName, contentType, blob, progressCallback) {

    }
}

function makeTxnId() {
    const n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const str = n.toString(16);
    return "t" + "0".repeat(14 - str.length) + str;
}

export default class SendQueue {
    constructor({roomId, storage, scheduler, pendingEvents}) {
        this._roomId = roomId;
        this._storage = storage;
        this._scheduler = scheduler;
        this._pendingEvents = pendingEvents.map(d => PendingEvent.fromData(d));
    }

    async _sendLoop() {
        let pendingEvent = null;
        // eslint-disable-next-line no-cond-assign
        while (pendingEvent = await this._nextPendingEvent()) {
            // const mxcUrl = await this._scheduler.runSlot(slot => {
            //     return slot.uploadMedia(fileName, contentType, blob, bytesSent => {
            //         pendingEvent.updateAttachmentUploadProgress(bytesSent);
            //     });
            // });

            // pendingEvent.setAttachmentUrl(mxcUrl);
            //update storage for pendingEvent after updating url,
            //remove blob only later to keep preview?

            await this._scheduler.runSlot(slot => {
                if (pendingEvent.isRedaction) {
                    return slot.sendRedaction(pendingEvent);
                } else if (pendingEvent.isContentEvent) {
                    return slot.sendContentEvent(pendingEvent);
                }
            });
        }
    }

    async enqueueEvent(eventType, content) {
        // temporary
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        const pendingEventsStore = txn.pendingEvents;
        const maxQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
        const queueIndex = maxQueueIndex + 1;
        const pendingEvent = new PendingEvent(this._roomId, queueIndex, eventType, content, makeTxnId());
        pendingEventsStore.add(pendingEvent.data);
        await txn.complete();
        // create txnId
        // create queueOrder
        // store event
        // if online and not running send loop
            // start sending loop
    }
}
