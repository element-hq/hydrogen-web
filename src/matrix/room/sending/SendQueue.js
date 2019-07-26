import SortedArray from "../../../observable/list/SortedArray.js";
import {NetworkError} from "../../error.js";
import {StorageError} from "../../storage/common.js";
import PendingEvent from "./PendingEvent.js";

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
        this._pendingEvents = new SortedArray((a, b) => a.queueIndex - b.queueIndex);
        this._pendingEvents.setManySorted(pendingEvents.map(data => new PendingEvent(data)));
        this._isSending = false;
        this._offline = false;
        this._amountSent = 0;
    }

    async _sendLoop() {
        this._isSending = true;
        try {
            while (this._amountSent < this._pendingEvents.length) {
                const pendingEvent = this._pendingEvents.get(this._amountSent);
                this._amountSent += 1;
                if (pendingEvent.remoteId) {
                    continue;
                }
                const response = await this._scheduler.request(hsApi => {
                    return hsApi.send(
                        pendingEvent.roomId,
                        pendingEvent.eventType,
                        pendingEvent.txnId,
                        pendingEvent.content
                    );
                });
                pendingEvent.remoteId = response.event_id;
                await this._tryUpdateEvent(pendingEvent);
            }
        } catch(err) {
            if (err instanceof NetworkError) {
                this._offline = true;
            }
        } finally {
            this._isSending = false;
        }
    }


    async receiveRemoteEcho(txnId) {
        const idx = this._pendingEvents.array.findIndex(pe => pe.txnId === txnId);
        if (idx !== 0) {
            const pendingEvent = this._pendingEvents.get(idx);
            this._amountSent -= 1;
            this._pendingEvents.remove(idx);
            await this._removeEvent(pendingEvent);
        }
    }

    resumeSending() {
        this._offline = false;
        if (!this._isSending) {
            this._sendLoop();
        }
    }

    async enqueueEvent(eventType, content) {
        const pendingEvent = await this._createAndStoreEvent(eventType, content);
        this._pendingEvents.set(pendingEvent);
        if (!this._isSending && !this._offline) {
            this._sendLoop();
        }
    }

    get pendingEvents() {
        return this._pendingEvents;
    }

    async _tryUpdateEvent(pendingEvent) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        try {
            // pendingEvent might have been removed already here
            // by a racing remote echo, so check first so we don't recreate it
            if (await txn.pendingEvents.exists(pendingEvent.roomId, pendingEvent.queueIndex)) {
                txn.pendingEvents.update(pendingEvent.data);
            }
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
    }

    async _removeEvent(pendingEvent) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        try {
            txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
    }

    async _createAndStoreEvent(eventType, content) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        let pendingEvent;
        try {
            const pendingEventsStore = txn.pendingEvents;
            const maxQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
            const queueIndex = maxQueueIndex + 1;
            pendingEvent = new PendingEvent({
                roomId: this._roomId,
                queueIndex,
                eventType,
                content,
                txnId: makeTxnId()
            });
            pendingEventsStore.add(pendingEvent.data);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return pendingEvent;
    }
}
