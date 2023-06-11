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

import {SortedArray} from "../../../observable/list/SortedArray";
import {ConnectionError} from "../../error.js";
import {PendingEvent, SendStatus} from "./PendingEvent.js";
import {makeTxnId, isTxnId} from "../../common.js";
import {REDACTION_TYPE} from "../common";
import {getRelationFromContent, getRelationTarget, setRelationTarget, REACTION_TYPE, ANNOTATION_RELATION_TYPE} from "../timeline/relations.js";

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
        this._currentQueueIndex = 0;
    }

    _createPendingEvent(data, attachments = null) {
        const pendingEvent = new PendingEvent({
            data,
            remove: () => this._removeEvent(pendingEvent),
            emitUpdate: params => this._pendingEvents.update(pendingEvent, params),
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
                            this._currentQueueIndex = pendingEvent.queueIndex;
                            await this._sendEvent(pendingEvent, log);
                        } catch(err) {
                            if (err instanceof ConnectionError) {
                                this._offline = true;
                                log.set("offline", true);
                                pendingEvent.setWaiting();
                            } else {
                                log.catch(err);
                                const isPermanentError = err.name === "HomeServerError" && (
                                    err.statusCode === 400 ||   // bad request, must be a bug on our end
                                    err.statusCode === 403 ||   // forbidden
                                    err.statusCode === 404      // not found
                                );
                                if (isPermanentError) {
                                    log.set("remove", true);
                                    await pendingEvent.abort();
                                } else {
                                    pendingEvent.setError(err);
                                }
                            }
                        } finally {
                            this._currentQueueIndex = 0;
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
            const encryptionContent = pendingEvent.contentForEncryption;
            const {type, content} = await log.wrap("encrypt", log => this._roomEncryption.encrypt(
                pendingEvent.eventType, encryptionContent, this._hsApi, log));
            pendingEvent.setEncrypted(type, content);
            await this._tryUpdateEvent(pendingEvent);
        }
        if (pendingEvent.needsSending) {
            await pendingEvent.send(this._hsApi, log);
            // we now have a remoteId, but this pending event may be removed at any point in the future
            // (or past, so can't assume it still exists) once the remote echo comes in.
            // So if we have any related events that need to resolve the relatedTxnId to a related event id,
            // they need to do so now.
            // We ensure this by writing the new remote id for the pending event and all related events
            // with unresolved relatedTxnId in the queue in one transaction.
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
            try {
                await this._tryUpdateEventWithTxn(pendingEvent, txn);
                await this._resolveRemoteIdInPendingRelations(
                    pendingEvent.txnId, pendingEvent.remoteId, txn);
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
        }
    }

    async _resolveRemoteIdInPendingRelations(txnId, remoteId, txn) {
        const relatedEventWithoutRemoteId = this._pendingEvents.array.filter(pe => {
            return pe.relatedTxnId === txnId && pe.relatedEventId !== remoteId;
        });
        for (const relatedPE of relatedEventWithoutRemoteId) {
            relatedPE.setRelatedEventId(remoteId);
            await this._tryUpdateEventWithTxn(relatedPE, txn);
        }
        return relatedEventWithoutRemoteId;
    }

    async removeRemoteEchos(events, txn, parentLog) {
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
                const remoteId = event.event_id;
                parentLog.log({l: "removeRemoteEcho", queueIndex: pendingEvent.queueIndex, remoteId, txnId});
                txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
                removed.push(pendingEvent);
                await this._resolveRemoteIdInPendingRelations(txnId, remoteId, txn);
            }
        }
        return removed;
    }

    async _removeEvent(pendingEvent) {
        let hasEvent = this._pendingEvents.array.indexOf(pendingEvent) !== -1;
        if (hasEvent) {
            const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
            try {
                txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
            } catch (err) {
                txn.abort();
            }
            await txn.complete();
            // lookup index after async txn is complete,
            // to make sure we're not racing with anything
            const idx = this._pendingEvents.array.indexOf(pendingEvent);
            if (idx !== -1) {
                this._pendingEvents.remove(idx);
            }
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
        const relation = getRelationFromContent(content);
        let relatedTxnId = null;
        if (relation) {
            const relationTarget = getRelationTarget(relation);
            if (isTxnId(relationTarget)) {
                relatedTxnId = relationTarget;
                setRelationTarget(relation, null);
            }
            if (relation.rel_type === ANNOTATION_RELATION_TYPE) {
                // Here we know the shape of the relation, and can use event_id safely
                const isAlreadyAnnotating = this._pendingEvents.array.some(pe => {
                    const r = getRelationFromContent(pe.content);
                    return pe.eventType === eventType && r && r.key === relation.key &&
                        (pe.relatedTxnId === relatedTxnId || r.event_id === relation.event_id);
                });
                if (isAlreadyAnnotating) {
                    log.set("already_annotating", true);
                    return;
                }
            }
        }
        return await this._enqueueEvent(eventType, content, attachments, relatedTxnId, null, log);
    }

    async _enqueueEvent(eventType, content, attachments, relatedTxnId, relatedEventId, log) {
        const pendingEvent = await this._createAndStoreEvent(eventType, content, relatedTxnId, relatedEventId, attachments);
        this._pendingEvents.set(pendingEvent);
        log.set("queueIndex", pendingEvent.queueIndex);
        log.set("pendingEvents", this._pendingEvents.length);
        if (!this._isSending && !this._offline) {
            this._sendLoop(log);
        }
        if (this._sendLoopLogItem) {
            log.refDetached(this._sendLoopLogItem);
        }
        return pendingEvent;
    }

    async enqueueRedaction(eventIdOrTxnId, reason, log) {
        const isAlreadyRedacting = this._pendingEvents.array.some(pe => {
            return pe.eventType === REDACTION_TYPE &&
                (pe.relatedTxnId === eventIdOrTxnId || pe.relatedEventId === eventIdOrTxnId);
        });
        if (isAlreadyRedacting) {
            log.set("already_redacting", true);
            return;
        }
        let relatedTxnId;
        let relatedEventId;
        if (isTxnId(eventIdOrTxnId)) {
            relatedTxnId = eventIdOrTxnId;
            const txnId = eventIdOrTxnId;
            const pe = this._pendingEvents.array.find(pe => pe.txnId === txnId);
            if (pe && !pe.remoteId && pe.status !== SendStatus.Sending) {
                // haven't started sending this event yet,
                // just remove it from the queue
                log.set("remove", relatedTxnId);
                await pe.abort();
                return;
            } else if (pe) {
                relatedEventId = pe.remoteId;
            } else {
                // we don't have the pending event anymore,
                // the remote echo must have arrived in the meantime.
                // we could look for it in the timeline, but for now
                // we don't do anything as this race is quite unlikely
                // and a bit complicated to fix.
                return;
            }
        } else {
            relatedEventId = eventIdOrTxnId;
            const pe = this._pendingEvents.array.find(pe => pe.remoteId === relatedEventId);
            if (pe) {
                // also set the txn id just in case that an event id was passed
                // for relating to a pending event that is still waiting for the remote echo
                relatedTxnId = pe.txnId;
            }
        }
        log.set("relatedTxnId", relatedTxnId);
        log.set("relatedEventId", relatedEventId);
        await this._enqueueEvent(REDACTION_TYPE, {reason}, null, relatedTxnId, relatedEventId, log);
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

    async _createAndStoreEvent(eventType, content, relatedTxnId, relatedEventId, attachments) {
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
        let pendingEvent;
        try {
            const pendingEventsStore = txn.pendingEvents;
            const maxStorageQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
            // don't use the queueIndex of the pendingEvent currently waiting for /send to return
            // if the remote echo already removed the pendingEvent in storage, as the send loop
            // wouldn't be able to detect the remote echo already arrived and end up overwriting the new event
            const maxQueueIndex = Math.max(maxStorageQueueIndex, this._currentQueueIndex);
            const queueIndex = maxQueueIndex + 1;
            const needsEncryption = eventType !== REDACTION_TYPE &&
                eventType !== REACTION_TYPE &&
                !!this._roomEncryption;
            pendingEvent = this._createPendingEvent({
                roomId: this._roomId,
                queueIndex,
                eventType,
                content,
                relatedTxnId,
                relatedEventId,
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

import {HomeServer as MockHomeServer} from "../../../mocks/HomeServer.js";
import {createMockStorage} from "../../../mocks/Storage";
import {ListObserver} from "../../../mocks/ListObserver.js";
import {NullLogger, NullLogItem} from "../../../logging/NullLogger";
import {createEvent, withTextBody, withTxnId} from "../../../mocks/event.js";
import {poll} from "../../../mocks/poll.js";
import {createAnnotation} from "../timeline/relations.js";

export function tests() {
    const logger = new NullLogger();
    return {
        "enqueue second message when remote echo of first arrives before /send returns": async assert => {
            const storage = await createMockStorage();
            const hs = new MockHomeServer();
            // 1. enqueue and start send event 1
            const queue = new SendQueue({roomId: "!abc", storage, hsApi: hs.api});
            const event1 = withTextBody("message 1", createEvent("m.room.message", "$123"));
            await logger.run("event1", log => queue.enqueueEvent(event1.type, event1.content, null, log));
            assert.equal(queue.pendingEvents.length, 1);
            const sendRequest1 = hs.requests.send[0];
            // 2. receive remote echo, before /send has returned
            const remoteEcho = withTxnId(sendRequest1.arguments[2], event1);
            const txn = await storage.readWriteTxn([storage.storeNames.pendingEvents]);
            const removal = await logger.run("remote echo", log => queue.removeRemoteEchos([remoteEcho], txn, log));
            await txn.complete();
            assert.equal(removal.length, 1);
            queue.emitRemovals(removal);
            assert.equal(queue.pendingEvents.length, 0);
            // 3. now enqueue event 2
            const event2 = withTextBody("message 2", createEvent("m.room.message", "$456"));
            await logger.run("event2", log => queue.enqueueEvent(event2.type, event2.content, null, log));
            // even though the first pending event has been removed by the remote echo,
            // the second should get the next index, as the send loop is still blocking on the first one
            assert.equal(Array.from(queue.pendingEvents)[0].queueIndex, 2);
            // 4. send for event 1 comes back
            sendRequest1.respond({event_id: event1.event_id});
            // 5. now expect second send request for event 2
            const sendRequest2 = await poll(() => hs.requests.send[1]);
            sendRequest2.respond({event_id: event2.event_id});
            await poll(() => !queue._isSending);
        },
        "redaction of pending event that hasn't started sending yet aborts it": async assert => {
            const queue = new SendQueue({
                roomId: "!abc",
                storage: await createMockStorage(),
                hsApi: new MockHomeServer().api
            });
            // first, enqueue a message that will be attempted to send, but we don't respond
            await queue.enqueueEvent("m.room.message", {body: "hello!"}, null, new NullLogItem());

            const observer = new ListObserver();
            queue.pendingEvents.subscribe(observer);
            await queue.enqueueEvent("m.room.message", {body: "...world"}, null, new NullLogItem());
            let txnId;
            {
                const {type, index, value} = await observer.next();
                assert.equal(type, "add");
                assert.equal(index, 1);
                assert.equal(typeof value.txnId, "string");
                txnId = value.txnId;
            }
            await queue.enqueueRedaction(txnId, null, new NullLogItem());
            {
                const {type, value, index} = await observer.next();
                assert.equal(type, "remove");
                assert.equal(index, 1);
                assert.equal(txnId, value.txnId);
            }
        },
        "duplicate redaction gets dropped": async assert => {
            const queue = new SendQueue({
                roomId: "!abc",
                storage: await createMockStorage(),
                hsApi: new MockHomeServer().api
            });
            assert.equal(queue.pendingEvents.length, 0);
            await queue.enqueueRedaction("!event", null, new NullLogItem());
            assert.equal(queue.pendingEvents.length, 1);
            await queue.enqueueRedaction("!event", null, new NullLogItem());
            assert.equal(queue.pendingEvents.length, 1);
        },
        "duplicate reaction gets dropped": async assert => {
            const queue = new SendQueue({
                roomId: "!abc",
                storage: await createMockStorage(),
                hsApi: new MockHomeServer().api
            });
            assert.equal(queue.pendingEvents.length, 0);
            await queue.enqueueEvent("m.reaction", createAnnotation("!target", "🚀"), null, new NullLogItem());
            assert.equal(queue.pendingEvents.length, 1);
            await queue.enqueueEvent("m.reaction", createAnnotation("!target", "👋"), null, new NullLogItem());
            assert.equal(queue.pendingEvents.length, 2);
            await queue.enqueueEvent("m.reaction", createAnnotation("!target", "🚀"), null, new NullLogItem());
            assert.equal(queue.pendingEvents.length, 2);
        },
        
    }
}
