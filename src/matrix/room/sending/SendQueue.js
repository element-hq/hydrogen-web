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

import {SortedArray} from "../../../observable/list/SortedArray.js";
import {ConnectionError} from "../../error.js";
import {PendingEvent} from "./PendingEvent.js";
import {makeTxnId} from "../../common.js";

export class SendQueue {
    constructor({roomId, storage, hsApi, pendingEvents}) {
        pendingEvents = pendingEvents || [];
        this._roomId = roomId;
        this._storage = storage;
        this._hsApi = hsApi;
        this._pendingEvents = new SortedArray((a, b) => a.queueIndex - b.queueIndex);
        if (pendingEvents.length) {
            console.info(`SendQueue for room ${roomId} has ${pendingEvents.length} pending events`, pendingEvents);
        }
        this._pendingEvents.setManyUnsorted(pendingEvents.map(data => new PendingEvent(data)));
        this._isSending = false;
        this._offline = false;
        this._amountSent = 0;
        this._roomEncryption = null;
    }

    enableEncryption(roomEncryption) {
        this._roomEncryption = roomEncryption;
    }

    async _sendLoop() {
        this._isSending = true;
        try {
            console.log("start sending", this._amountSent, "<", this._pendingEvents.length);
            while (this._amountSent < this._pendingEvents.length) {
                const pendingEvent = this._pendingEvents.get(this._amountSent);
                console.log("trying to send", pendingEvent.content.body);
                if (pendingEvent.remoteId) {
                    continue;
                }
                if (pendingEvent.needsEncryption) {
                    const {type, content} = await this._roomEncryption.encrypt(
                        pendingEvent.eventType, pendingEvent.content, this._hsApi);
                    pendingEvent.setEncrypted(type, content);
                    await this._tryUpdateEvent(pendingEvent);
                }
                console.log("really sending now");
                const response = await this._hsApi.send(
                        pendingEvent.roomId,
                        pendingEvent.eventType,
                        pendingEvent.txnId,
                        pendingEvent.content
                    ).response();
                pendingEvent.remoteId = response.event_id;
                // 
                console.log("writing remoteId now");
                await this._tryUpdateEvent(pendingEvent);
                console.log("keep sending?", this._amountSent, "<", this._pendingEvents.length);
                this._amountSent += 1;
            }
        } catch(err) {
            if (err instanceof ConnectionError) {
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
            let idx;
            if (txnId) {
                idx = this._pendingEvents.array.findIndex(pe => pe.txnId === txnId);
            } else {
                idx = this._pendingEvents.array.findIndex(pe => pe.remoteId === event.event_id);
            }
            if (idx !== -1) {
                const pendingEvent = this._pendingEvents.get(idx);
                txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
                removed.push(pendingEvent);
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

    async enqueueEvent(eventType, content) {
        const pendingEvent = await this._createAndStoreEvent(eventType, content);
        this._pendingEvents.set(pendingEvent);
        console.log("added to _pendingEvents set", this._pendingEvents.length);
        if (!this._isSending && !this._offline) {
            this._sendLoop();
        }
    }

    get pendingEvents() {
        return this._pendingEvents;
    }

    async _tryUpdateEvent(pendingEvent) {
        const txn = this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
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

    async _createAndStoreEvent(eventType, content) {
        console.log("_createAndStoreEvent");
        const txn = this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
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
                txnId: makeTxnId(),
                needsEncryption: !!this._roomEncryption
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
