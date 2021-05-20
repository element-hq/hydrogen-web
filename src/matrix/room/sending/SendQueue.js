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
import {PendingEvent, SendStatus} from "./PendingEvent.js";
import {makeTxnId, isTxnId} from "../../common.js";
import {REDACTION_TYPE} from "../common.js";

export class SendQueue {
    constructor({roomId, storage, hsApi, pendingEvents}) {
        pendingEvents = pendingEvents || [];
        this._roomId = roomId;
        this._storage = storage;
        this._hsApi = hsApi;
        this._pendingEvents = new SortedArray((a, b) => a.queueIndex - b.queueIndex);
        this._pendingEvents.setManyUnsorted(pendingEvents.map(data => this._createPendingEvent(data)));
        this._isSending = false;
        this._offline = false;
        this._roomEncryption = null;
    }

    _createPendingEvent(data, attachments = null) {
        const pendingEvent = new PendingEvent({
            data,
            remove: () => this._removeEvent(pendingEvent),
            emitUpdate: () => this._pendingEvents.update(pendingEvent),
            attachments
        });
        return pendingEvent;
    }

    enableEncryption(roomEncryption) {
        this._roomEncryption = roomEncryption;
    }

    _sendLoop(log) {
        this._isSending = true;
        this._sendLoopLogItem = log.runDetached("send queue flush", async log => {
            try {
                for (const pendingEvent of this._pendingEvents) {
                    await log.wrap("send event", async log => {
                        log.set("queueIndex", pendingEvent.queueIndex);
                        try {
                            await this._sendEvent(pendingEvent, log);
                        } catch(err) {
                            if (err instanceof ConnectionError) {
                                this._offline = true;
                                log.set("offline", true);
                                pendingEvent.setWaiting();
                            } else {
                                log.catch(err);
                                pendingEvent.setError(err);
                            }
                        }
                    });
                }
            } finally {
                this._isSending = false;
                this._sendLoopLogItem = null;
            }
        });
    }

    async _sendEvent(pendingEvent, log) {
        if (pendingEvent.needsUpload) {
            await log.wrap("upload attachments", log => pendingEvent.uploadAttachments(this._hsApi, log));
            await this._tryUpdateEvent(pendingEvent);
        }
        if (pendingEvent.needsEncryption) {
            pendingEvent.setEncrypting();
            const {type, content} = await log.wrap("encrypt", log => this._roomEncryption.encrypt(
                pendingEvent.eventType, pendingEvent.content, this._hsApi, log));
            pendingEvent.setEncrypted(type, content);
            await this._tryUpdateEvent(pendingEvent);
        }
        if (pendingEvent.needsSending) {
            await pendingEvent.send(this._hsApi, log);
            // we now have a remoteId, but this pending event may be removed at any point in the future
            // once the remote echo comes in. So if we have any related events that need to resolve
            // the relatedTxnId to a related event id, they need to do so now.
            // We ensure this by writing the new remote id for the pending event and all related events
            // with unresolved relatedTxnId in the queue in one transaction.
            const relatedEvents = this._pendingEvents.array.find(pe => pe.relatedTxnId === pendingEvent.txnId);
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
            try {
                await this._tryUpdateEventWithTxn(pendingEvent, txn);
                for (const relatedPE of relatedEvents) {
                    relatedPE.setRelatedEventId(pendingEvent.remoteId);
                    await this._tryUpdateEventWithTxn(relatedPE, txn);
                }
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
        }
    }

    removeRemoteEchos(events, txn, parentLog) {
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
                parentLog.log({l: "removeRemoteEcho", queueIndex: pendingEvent.queueIndex, remoteId: event.event_id, txnId});
                txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
                removed.push(pendingEvent);
            }
        }
        return removed;
    }

    async _removeEvent(pendingEvent) {
        const idx = this._pendingEvents.array.indexOf(pendingEvent);
        if (idx !== -1) {
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
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

    resumeSending(parentLog) {
        this._offline = false;
        if (this._pendingEvents.length) {
            parentLog.wrap("resumeSending", log => {
                log.set("id", this._roomId);
                log.set("pendingEvents", this._pendingEvents.length);
                if (!this._isSending) {
                    this._sendLoop(log);
                }
                if (this._sendLoopLogItem) {
                    log.refDetached(this._sendLoopLogItem);
                }
            });
        }
    }

    async enqueueEvent(eventType, content, attachments, log) {
        await this._enqueueEvent(eventType, content, attachments, null, log);
    }


    async _enqueueEvent(eventType, content, attachments, redacts, log) {
        const pendingEvent = await this._createAndStoreEvent(eventType, content, redacts, attachments);
        this._pendingEvents.set(pendingEvent);
        log.set("queueIndex", pendingEvent.queueIndex);
        log.set("pendingEvents", this._pendingEvents.length);
        if (!this._isSending && !this._offline) {
            this._sendLoop(log);
        }
        if (this._sendLoopLogItem) {
            log.refDetached(this._sendLoopLogItem);
        }
    }

    async enqueueRedaction(eventIdOrTxnId, reason, log) {
        if (isTxnId(eventIdOrTxnId)) {
            const txnId = eventIdOrTxnId;
            const pe = this._pendingEvents.array.find(pe => pe.txnId === txnId);
            if (pe && !pe.remoteId && pe.status !== SendStatus.Sending) {
                // haven't started sending this event yet,
                // just remove it from the queue
                await pe.abort();
                return;
            } else if (!pe) {
                // we don't have the pending event anymore,
                // the remote echo must have arrived in the meantime.
                // we could look for it in the timeline, but for now
                // we don't do anything as this race is quite unlikely
                // and a bit complicated to fix.
                return;
            }
        }
        await this._enqueueEvent(REDACTION_TYPE, {reason}, null, eventIdOrTxnId, log);
    }

    get pendingEvents() {
        return this._pendingEvents;
    }

    async _tryUpdateEvent(pendingEvent) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        try {
            this._tryUpdateEventWithTxn(pendingEvent, txn);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
    }

    async _tryUpdateEventWithTxn(pendingEvent, txn) {
        // pendingEvent might have been removed already here
        // by a racing remote echo, so check first so we don't recreate it
        if (await txn.pendingEvents.exists(pendingEvent.roomId, pendingEvent.queueIndex)) {
            txn.pendingEvents.update(pendingEvent.data);
        }
    }

    async _createAndStoreEvent(eventType, content, redacts, attachments) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        let pendingEvent;
        try {
            const pendingEventsStore = txn.pendingEvents;
            const maxQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
            const queueIndex = maxQueueIndex + 1;
            const needsEncryption = eventType !== REDACTION_TYPE && !!this._roomEncryption;
            pendingEvent = this._createPendingEvent({
                roomId: this._roomId,
                queueIndex,
                eventType,
                content,
                redacts,
                txnId: makeTxnId(),
                needsEncryption,
                needsUpload: !!attachments
            }, attachments);
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
