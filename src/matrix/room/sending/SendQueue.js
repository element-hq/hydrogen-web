import SortedArray from "../../../observable/list/SortedArray.js";
import {NetworkError} from "../../error.js";
import PendingEvent from "./PendingEvent.js";

function makeTxnId() {
    const n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const str = n.toString(16);
    return "t" + "0".repeat(14 - str.length) + str;
}

export default class SendQueue {
    constructor({roomId, storage, sendScheduler, pendingEvents}) {
        pendingEvents = pendingEvents || [];
        this._roomId = roomId;
        this._storage = storage;
        this._sendScheduler = sendScheduler;
        this._pendingEvents = new SortedArray((a, b) => a.queueIndex - b.queueIndex);
        if (pendingEvents.length) {
            console.info(`SendQueue for room ${roomId} has ${pendingEvents.length} pending events`, pendingEvents);
        }
        this._pendingEvents.setManyUnsorted(pendingEvents.map(data => new PendingEvent(data)));
        this._isSending = false;
        this._offline = false;
        this._amountSent = 0;
    }

    async _sendLoop() {
        this._isSending = true;
        try {
            console.log("start sending", this._amountSent, "<", this._pendingEvents.length);
            while (this._amountSent < this._pendingEvents.length) {
                const pendingEvent = this._pendingEvents.get(this._amountSent);
                console.log("trying to send", pendingEvent.content.body);
                this._amountSent += 1;
                if (pendingEvent.remoteId) {
                    continue;
                }
                console.log("really sending now");
                const response = await this._sendScheduler.request(hsApi => {
                    console.log("got sendScheduler slot");
                    return hsApi.send(
                        pendingEvent.roomId,
                        pendingEvent.eventType,
                        pendingEvent.txnId,
                        pendingEvent.content
                    );
                });
                pendingEvent.remoteId = response.event_id;
                // 
                console.log("writing remoteId now");
                await this._tryUpdateEvent(pendingEvent);
                console.log("keep sending?", this._amountSent, "<", this._pendingEvents.length);
            }
        } catch(err) {
            if (err instanceof NetworkError) {
                this._offline = true;
            }
        } finally {
            this._isSending = false;
        }
    }

    removeRemoteEchos(events, txn) {
        const removed = [];
        for (const event of events) {
            const txnId = event.unsigned && event.unsigned.transaction_id;
            if (txnId) {
                const idx = this._pendingEvents.array.findIndex(pe => pe.txnId === txnId);
                if (idx !== -1) {
                    const pendingEvent = this._pendingEvents.get(idx);
                    txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
                    removed.push(pendingEvent);
                }
            }
        }
        return removed;
    }

    emitRemovals(pendingEvents) {
        for (const pendingEvent of pendingEvents) {
            const idx = this._pendingEvents.array.indexOf(pendingEvent);
            if (idx !== -1) {
                this._amountSent -= 1;
                this._pendingEvents.remove(idx);
            }
        }
    }

    resumeSending() {
        this._offline = false;
        if (!this._isSending) {
            this._sendLoop();
        }
    }

    async enqueueEvent(eventType, content, log) {
        const pendingEvent = await log.descend("store pending event").wrap(
            log => this._createAndStoreEvent(eventType, content, log));
        this._pendingEvents.set(pendingEvent);
        log.set("pendingEvents", this._pendingEvents.length);
        if (!this._isSending && !this._offline) {
            this._sendLoop();
        }
    }

    get pendingEvents() {
        return this._pendingEvents;
    }

    async _tryUpdateEvent(pendingEvent) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        console.log("_tryUpdateEvent: got txn");
        try {
            // pendingEvent might have been removed already here
            // by a racing remote echo, so check first so we don't recreate it
            console.log("_tryUpdateEvent: before exists");
            if (await txn.pendingEvents.exists(pendingEvent.roomId, pendingEvent.queueIndex)) {
                console.log("_tryUpdateEvent: inside if exists");
                txn.pendingEvents.update(pendingEvent.data);
            }
            console.log("_tryUpdateEvent: after exists");
        } catch (err) {
            txn.abort();
            console.log("_tryUpdateEvent: error", err);
            throw err;
        }
        console.log("_tryUpdateEvent: try complete");
        await txn.complete();
    }

    async _createAndStoreEvent(eventType, content, logger) {
        console.log("_createAndStoreEvent");
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        let pendingEvent;
        try {
            const pendingEventsStore = txn.pendingEvents;
            console.log("_createAndStoreEvent getting maxQueueIndex");
            const maxQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
            console.log("_createAndStoreEvent got maxQueueIndex", maxQueueIndex);
            const queueIndex = maxQueueIndex + 1;
            pendingEvent = new PendingEvent({
                roomId: this._roomId,
                queueIndex,
                eventType,
                content,
                txnId: makeTxnId()
            });
            console.log("_createAndStoreEvent: adding to pendingEventsStore");
            pendingEventsStore.add(pendingEvent.data);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return pendingEvent;
    }
}
