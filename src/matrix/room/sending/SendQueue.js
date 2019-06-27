class Sender {
    constructor({hsApi}) {
        this._hsApi = hsApi;
        this._slotRequests = [];
        this._sendScheduled = false;
        this._offline = false;
        this._waitTime = 0;
    }

    // this should really be per roomId to avoid head-of-line blocking
    acquireSlot() {
        let request;
        const promise = new Promise((resolve) => request = {resolve});
        this._slotRequests.push(request);
        if (!this._sendScheduled) {
            this._startNextSlot();
        }
        return promise;
    }

    async _startNextSlot() {
        if (this._waitTime !== 0) {
            await Platform.delay(this._waitTime);
        }
        const request = this._slotRequests.unshift();
        this._currentSlot = new SenderSlot(this);
        request.resolve(this._currentSlot);
    }

    _discardSlot(slot) {
        if (slot === this._currentSlot) {
            this._currentSlot = null;
            this._sendScheduled = true;
            Promise.resolve().then(() => this._startNextSlot());
        }
    }

    async _doSend(slot, callback) {
        this._sendScheduled = false;
        if (slot !== this._currentSlot) {
            throw new Error("slot is not active");
        }
        try {
            // loop is left by return or throw
            while(true) {
                try {
                    return await callback(this._hsApi);
                } catch (err) {
                    if (err instanceof HomeServerError && err.errcode === "M_LIMIT_EXCEEDED") {
                        await Platform.delay(err.retry_after_ms);
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err) {
            if (err instanceof NetworkError) {
                this._offline = true;
                // went offline, probably want to notify SendQueues somehow
            }
            throw err;
        } finally {
            this._currentSlot = null;
            if (!this._offline && this._slotRequests.length) {
                this._sendScheduled = true;
                Promise.resolve().then(() => this._startNextSlot());
            }
        }
    }
}

class SenderSlot {
    constructor(sender) {
        this._sender = sender;
    }

    sendEvent(pendingEvent) {
        return this._sender._doSend(this, async hsApi => {
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

    discard() {
        this._sender._discardSlot(this);
    }
}

export default class SendQueue {
    constructor({sender})
}
