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
        this._pendingEvents.setManyUnsorted(pendingEvents.map(data => this._createPendingEvent(data)));
        this._isSending = false;
        this._offline = false;
        this._roomEncryption = null;
    }

    _createPendingEvent(data, attachments = null) {
        const pendingEvent = new PendingEvent({
            data,
            remove: () => this._removeEvent(pendingEvent),
            emitUpdate: () => this._pendingEvents.set(pendingEvent),
            attachments
        });
        return pendingEvent;
    }

    enableEncryption(roomEncryption) {
        this._roomEncryption = roomEncryption;
    }

    async _sendLoop() {
        this._isSending = true;
        try {
            for (let i = 0; i < this._pendingEvents.length; i += 1) {
                const pendingEvent = this._pendingEvents.get(i);
                try {
                    await this._sendEvent(pendingEvent);
                } catch(err) {
                    if (err instanceof ConnectionError) {
                        this._offline = true;
                        break;
                    } else {
                        pendingEvent.setError(err);
                    }
                } 
            }
        } finally {
            this._isSending = false;
        }
    }

    async _sendEvent(pendingEvent) {
        if (pendingEvent.needsUpload) {
            await pendingEvent.uploadAttachments(this._hsApi);
            console.log("attachments upload, content is now", pendingEvent.content);
            await this._tryUpdateEvent(pendingEvent);
        }
        if (pendingEvent.needsEncryption) {
            pendingEvent.setEncrypting();
            const {type, content} = await this._roomEncryption.encrypt(
                pendingEvent.eventType, pendingEvent.content, this._hsApi);
            pendingEvent.setEncrypted(type, content);
            await this._tryUpdateEvent(pendingEvent);
        }
        if (pendingEvent.needsSending) {
            await pendingEvent.send(this._hsApi);
            console.log("writing remoteId");
            await this._tryUpdateEvent(pendingEvent);
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

    async _removeEvent(pendingEvent) {
        const idx = this._pendingEvents.array.indexOf(pendingEvent);
        if (idx !== -1) {
            const txn = this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
            try {
                txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
            } catch (err) {
                txn.abort();
            }
            await txn.complete();
            this._pendingEvents.remove(idx);
        }
        pendingEvent.dispose();
    }

    emitRemovals(pendingEvents) {
        for (const pendingEvent of pendingEvents) {
            const idx = this._pendingEvents.array.indexOf(pendingEvent);
            if (idx !== -1) {
                this._pendingEvents.remove(idx);
            }
            pendingEvent.dispose();
        }
    }

    resumeSending() {
        this._offline = false;
        if (!this._isSending) {
            this._sendLoop();
        }
    }

    async enqueueEvent(eventType, content, attachments) {
        const pendingEvent = await this._createAndStoreEvent(eventType, content, attachments);
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

    async _createAndStoreEvent(eventType, content, attachments) {
        console.log("_createAndStoreEvent");
        const txn = this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        let pendingEvent;
        try {
            const pendingEventsStore = txn.pendingEvents;
            console.log("_createAndStoreEvent getting maxQueueIndex");
            const maxQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
            console.log("_createAndStoreEvent got maxQueueIndex", maxQueueIndex);
            const queueIndex = maxQueueIndex + 1;
            pendingEvent = this._createPendingEvent({
                roomId: this._roomId,
                queueIndex,
                eventType,
                content,
                txnId: makeTxnId(),
                needsEncryption: !!this._roomEncryption,
                needsUpload: !!attachments
            }, attachments);
            console.log("_createAndStoreEvent: adding to pendingEventsStore");
            pendingEventsStore.add(pendingEvent.data);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return pendingEvent;
    }

    dispose() {
        for (const pe of this._pendingEvents) {
            pe.dispose();
        }
    }
}
