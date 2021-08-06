/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {EventEntry} from "../entries/EventEntry.js";
import {REDACTION_TYPE, isRedacted} from "../../common.js";
import {ANNOTATION_RELATION_TYPE, getRelation} from "../relations.js";

export class RelationWriter {
    constructor({roomId, ownUserId, fragmentIdComparer}) {
        this._roomId = roomId;
        this._ownUserId = ownUserId;
        this._fragmentIdComparer = fragmentIdComparer;
    }

    // this needs to happen again after decryption too for edits
    async writeRelation(sourceEntry, txn, log) {
        const {relatedEventId} = sourceEntry;
        if (relatedEventId) {
            const relation = getRelation(sourceEntry.event);
            if (relation && relation.rel_type) {
                // we don't consider replies (which aren't relations in the MSC2674 sense)
                txn.timelineRelations.add(this._roomId, relation.event_id, relation.rel_type, sourceEntry.id);
            }
            const target = await txn.timelineEvents.getByEventId(this._roomId, relatedEventId);
            if (target) {
                const updatedStorageEntries = await this._applyRelation(sourceEntry, target, txn, log);
                if (updatedStorageEntries) {
                    return updatedStorageEntries.map(e => {
                        txn.timelineEvents.update(e);
                        return new EventEntry(e, this._fragmentIdComparer);
                    });
                }
            }
        }
        return null;
    }

    /**
     * @param {Object} storageEntry the event object, as it will be stored in storage.
     *        Will be modified (but not written to storage) in case this event is
     *        a relation target for which we've previously received relations.
     * @param {Direction} direction of the gap fill
     * */
    async writeGapRelation(storageEntry, direction, txn, log) {
        const sourceEntry = new EventEntry(storageEntry, this._fragmentIdComparer);
        const result = await this.writeRelation(sourceEntry, txn, log);
        // when back-paginating, it can also happen that we've received relations
        // for this event before, which now upon receiving the target need to be aggregated.
        if (direction.isBackward && !isRedacted(storageEntry.event)) {
            const relations = await txn.timelineRelations.getAllForTarget(this._roomId, sourceEntry.id);
            if (relations.length) {
                for (const r of relations) {
                    const relationStorageEntry = await txn.timelineEvents.getByEventId(this._roomId, r.sourceEventId);
                    if (relationStorageEntry) {
                        const relationEntry = new EventEntry(relationStorageEntry, this._fragmentIdComparer);
                        await this._applyRelation(relationEntry, storageEntry, txn, log);
                    }
                }
            }
        }

        return result;
    }

    /**
     * @param {EventEntry} sourceEntry
     * @param {Object} targetStorageEntry event entry as stored in the timelineEvents store
     * @return {[Object]} array of event storage entries that have been updated
     * */
    async _applyRelation(sourceEntry, targetStorageEntry, txn, log) {
        if (sourceEntry.eventType === REDACTION_TYPE) {
            return log.wrap("redact", async log => {
                const redactedEvent = targetStorageEntry.event;
                const relation = getRelation(redactedEvent); // get this before redacting
                const redacted = this._applyRedaction(sourceEntry.event, targetStorageEntry, txn, log);
                if (redacted) {
                    const updated = [targetStorageEntry];
                    if (relation) {
                        const relationTargetStorageEntry = await this._reaggregateRelation(redactedEvent, relation, txn, log);
                        if (relationTargetStorageEntry) {
                            updated.push(relationTargetStorageEntry);
                        }
                    }
                    return updated;
                }
                return null;
            });
        } else {
            const relation = getRelation(sourceEntry.event);
            if (relation && !isRedacted(targetStorageEntry.event)) {
                const relType = relation.rel_type;
                if (relType === ANNOTATION_RELATION_TYPE) {
                    const aggregated = log.wrap("react", log => {
                        return this._aggregateAnnotation(sourceEntry.event, targetStorageEntry, log);
                    });
                    if (aggregated) {
                        return [targetStorageEntry];
                    }
                }
            }
        }
        return null;
    }

    _applyRedaction(redactionEvent, redactedStorageEntry, txn, log) {
        const redactedEvent = redactedStorageEntry.event;
        log.set("redactionId", redactionEvent.event_id);
        log.set("id", redactedEvent.event_id);

        const relation = getRelation(redactedEvent);
        if (relation && relation.rel_type) {
            txn.timelineRelations.remove(this._roomId, relation.event_id, relation.rel_type, redactedEvent.event_id);
        }
        // check if we're the target of a relation and remove all relations then as well
        txn.timelineRelations.removeAllForTarget(this._roomId, redactedEvent.event_id);

        for (const key of Object.keys(redactedEvent)) {
            if (!_REDACT_KEEP_KEY_MAP[key]) {
                delete redactedEvent[key];
            }
        }
        const {content} = redactedEvent;
        const keepMap = _REDACT_KEEP_CONTENT_MAP[redactedEvent.type];
        for (const key of Object.keys(content)) {
            if (!keepMap?.[key]) {
                delete content[key];
            }
        }
        redactedEvent.unsigned = redactedEvent.unsigned || {};
        redactedEvent.unsigned.redacted_because = redactionEvent;

        delete redactedStorageEntry.annotations;

        return true;
    }

    _aggregateAnnotation(annotationEvent, targetStorageEntry, log) {
        // TODO: do we want to verify it is a m.reaction event somehow?
        const relation = getRelation(annotationEvent);
        if (!relation) {
            return false;
        }

        let {annotations} = targetStorageEntry;
        if (!annotations) {
            targetStorageEntry.annotations = annotations = {};
        }
        let annotation = annotations[relation.key];
        if (!annotation) {
            annotations[relation.key] = annotation = {
                count: 0,
                me: false,
                firstTimestamp: Number.MAX_SAFE_INTEGER
            };
        }
        const sentByMe = annotationEvent.sender === this._ownUserId;

        annotation.me = annotation.me || sentByMe;
        annotation.count += 1;
        annotation.firstTimestamp = Math.min(
            annotation.firstTimestamp,
            annotationEvent.origin_server_ts
        );

        return true;
    }

    async _reaggregateRelation(redactedRelationEvent, redactedRelation, txn, log) {
        if (redactedRelation.rel_type === ANNOTATION_RELATION_TYPE) {
            return log.wrap("reaggregate annotations", log => this._reaggregateAnnotation(
                redactedRelation.event_id,
                redactedRelation.key,
                txn, log
            ));
        }
        return null;
    }

    async _reaggregateAnnotation(targetId, key, txn, log) {
        const target = await txn.timelineEvents.getByEventId(this._roomId, targetId);
        if (!target) {
            return null;
        }
        log.set("id", targetId);
        const relations = await txn.timelineRelations.getForTargetAndType(this._roomId, targetId, ANNOTATION_RELATION_TYPE);
        log.set("relations", relations.length);
        delete target.annotations[key];
        if (isObjectEmpty(target.annotations)) {
            delete target.annotations;
        }
        await Promise.all(relations.map(async relation => {
            const annotation = await txn.timelineEvents.getByEventId(this._roomId, relation.sourceEventId);
            if (!annotation) {
                log.log({l: "missing annotation", id: relation.sourceEventId});
            }
            if (getRelation(annotation.event).key === key) {
                this._aggregateAnnotation(annotation.event, target, log);
            }
        }));
        return target;
    }
}

function isObjectEmpty(obj) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}

// copied over from matrix-js-sdk, copyright 2016 OpenMarket Ltd
/* _REDACT_KEEP_KEY_MAP gives the keys we keep when an event is redacted
 *
 * This is specified here:
 *  http://matrix.org/speculator/spec/HEAD/client_server/latest.html#redactions
 *
 * Also:
 *  - We keep 'unsigned' since that is created by the local server
 *  - We keep user_id for backwards-compat with v1
 */
const _REDACT_KEEP_KEY_MAP = [
    'event_id', 'type', 'room_id', 'user_id', 'sender', 'state_key', 'prev_state',
    'content', 'unsigned', 'origin_server_ts',
].reduce(function(ret, val) {
    ret[val] = 1; return ret;
}, {});

// a map from event type to the .content keys we keep when an event is redacted
const _REDACT_KEEP_CONTENT_MAP = {
    'm.room.member': {'membership': 1},
    'm.room.create': {'creator': 1},
    'm.room.join_rules': {'join_rule': 1},
    'm.room.power_levels': {'ban': 1, 'events': 1, 'events_default': 1,
                            'kick': 1, 'redact': 1, 'state_default': 1,
                            'users': 1, 'users_default': 1,
                           },
    'm.room.aliases': {'aliases': 1},
};
// end of matrix-js-sdk code

import {createMockStorage} from "../../../../mocks/Storage.js";
import {createEvent, withTextBody, withRedacts, withContent} from "../../../../mocks/event.js";
import {createAnnotation} from "../relations.js";
import {FragmentIdComparer} from "../FragmentIdComparer.js";
import {NullLogItem} from "../../../../logging/NullLogger.js";

export function tests() {
    const fragmentIdComparer = new FragmentIdComparer([]);
    const roomId = "$abc";
    const alice = "@alice:hs.tld";
    const bob = "@bob:hs.tld";

    return {
        "apply redaction": async assert => {
            const event = withTextBody("Dogs > Cats", createEvent("m.room.message", "!abc", bob));
            const reason = "nonsense, cats are the best!";
            const redaction = withRedacts(event.event_id, reason, createEvent("m.room.redaction", "!def", alice));
            const redactionEntry = new EventEntry({fragmentId: 1, eventIndex: 3, event: redaction, roomId}, fragmentIdComparer);
            const relationWriter = new RelationWriter({roomId, ownUserId: bob, fragmentIdComparer});

            const storage = await createMockStorage();
            const txn = await storage.readWriteTxn([storage.storeNames.timelineEvents, storage.storeNames.timelineRelations]);
            txn.timelineEvents.insert({fragmentId: 1, eventIndex: 2, event, roomId});
            const updatedEntries = await relationWriter.writeRelation(redactionEntry, txn, new NullLogItem());
            await txn.complete();

            assert.equal(updatedEntries.length, 1);
            const redactedMessage = updatedEntries[0];
            assert.equal(redactedMessage.id, "!abc");
            assert.equal(redactedMessage.content.body, undefined);
            assert.equal(redactedMessage.redactionReason, reason);
            
            const readTxn = await storage.readTxn([storage.storeNames.timelineEvents]);
            const storedMessage = await readTxn.timelineEvents.getByEventId(roomId, "!abc");
            await readTxn.complete();
            assert.equal(storedMessage.event.content.body, undefined);
            assert.equal(storedMessage.event.unsigned.redacted_because.content.reason, reason);
        },
        "aggregate reaction": async assert => {
            const event = withTextBody("Dogs > Cats", createEvent("m.room.message", "!abc", bob));
            const reaction = withContent(createAnnotation(event.event_id, "🐶"), createEvent("m.reaction", "!def", alice));
            reaction.origin_server_ts = 5;
            const reactionEntry = new EventEntry({event: reaction, roomId}, fragmentIdComparer);
            const relationWriter = new RelationWriter({roomId, ownUserId: alice, fragmentIdComparer});

            const storage = await createMockStorage();
            const txn = await storage.readWriteTxn([storage.storeNames.timelineEvents, storage.storeNames.timelineRelations]);
            txn.timelineEvents.insert({fragmentId: 1, eventIndex: 2, event, roomId});
            const updatedEntries = await relationWriter.writeRelation(reactionEntry, txn, new NullLogItem());
            await txn.complete();

            assert.equal(updatedEntries.length, 1);
            const reactedMessage = updatedEntries[0];
            assert.equal(reactedMessage.id, "!abc");
            const annotation = reactedMessage.annotations["🐶"];
            assert.equal(annotation.me, true);
            assert.equal(annotation.count, 1);
            assert.equal(annotation.firstTimestamp, 5);
            
            const readTxn = await storage.readTxn([storage.storeNames.timelineEvents]);
            const storedMessage = await readTxn.timelineEvents.getByEventId(roomId, "!abc");
            await readTxn.complete();
            assert(storedMessage.annotations["🐶"]);
        },
        "aggregate second reaction": async assert => {
            const event = withTextBody("Dogs > Cats", createEvent("m.room.message", "!abc", bob));
            const reaction1 = withContent(createAnnotation(event.event_id, "🐶"), createEvent("m.reaction", "!def", alice));
            reaction1.origin_server_ts = 5;
            const reaction1Entry = new EventEntry({event: reaction1, roomId}, fragmentIdComparer);
            const reaction2 = withContent(createAnnotation(event.event_id, "🐶"), createEvent("m.reaction", "!hij", bob));
            reaction2.origin_server_ts = 10;
            const reaction2Entry = new EventEntry({event: reaction2, roomId}, fragmentIdComparer);
            const relationWriter = new RelationWriter({roomId, ownUserId: alice, fragmentIdComparer});

            const storage = await createMockStorage();
            const txn = await storage.readWriteTxn([storage.storeNames.timelineEvents, storage.storeNames.timelineRelations]);
            txn.timelineEvents.insert({fragmentId: 1, eventIndex: 2, event, roomId});
            await relationWriter.writeRelation(reaction1Entry, txn, new NullLogItem());
            const updatedEntries = await relationWriter.writeRelation(reaction2Entry, txn, new NullLogItem());
            await txn.complete();

            assert.equal(updatedEntries.length, 1);

            const reactedMessage = updatedEntries[0];
            assert.equal(reactedMessage.id, "!abc");
            const annotation = reactedMessage.annotations["🐶"];
            assert.equal(annotation.me, true);
            assert.equal(annotation.count, 2);
            assert.equal(annotation.firstTimestamp, 5);
        },
        "redact second reaction": async assert => {
            const event = withTextBody("Dogs > Cats", createEvent("m.room.message", "!abc", bob));
            const myReaction = withContent(createAnnotation(event.event_id, "🐶"), createEvent("m.reaction", "!def", alice));
            myReaction.origin_server_ts = 5;
            const bobReaction = withContent(createAnnotation(event.event_id, "🐶"), createEvent("m.reaction", "!hij", bob));
            bobReaction.origin_server_ts = 10;
            const myReactionRedaction = withRedacts(myReaction.event_id, "", createEvent("m.room.redaction", "!pol", alice));

            const myReactionEntry = new EventEntry({event: myReaction, roomId}, fragmentIdComparer);
            const bobReactionEntry = new EventEntry({event: bobReaction, roomId}, fragmentIdComparer);
            const myReactionRedactionEntry = new EventEntry({event: myReactionRedaction, roomId}, fragmentIdComparer);
            const relationWriter = new RelationWriter({roomId, ownUserId: alice, fragmentIdComparer});

            const storage = await createMockStorage();
            const txn = await storage.readWriteTxn([storage.storeNames.timelineEvents, storage.storeNames.timelineRelations]);
            txn.timelineEvents.insert({fragmentId: 1, eventIndex: 2, event, roomId});
            txn.timelineEvents.insert({fragmentId: 1, eventIndex: 3, event: myReaction, roomId});
            await relationWriter.writeRelation(myReactionEntry, txn, new NullLogItem());
            txn.timelineEvents.insert({fragmentId: 1, eventIndex: 4, event: bobReaction, roomId});
            await relationWriter.writeRelation(bobReactionEntry, txn, new NullLogItem());
            const updatedEntries = await relationWriter.writeRelation(myReactionRedactionEntry, txn, new NullLogItem());
            await txn.complete();

            assert.equal(updatedEntries.length, 2);

            const redactedReaction = updatedEntries[0];
            assert.equal(redactedReaction.id, "!def");
            const reaggregatedMessage = updatedEntries[1];
            assert.equal(reaggregatedMessage.id, "!abc");
            const annotation = reaggregatedMessage.annotations["🐶"];
            assert.equal(annotation.me, false);
            assert.equal(annotation.count, 1);
            assert.equal(annotation.firstTimestamp, 10);

            const readTxn = await storage.readTxn([storage.storeNames.timelineEvents]);
            const storedMessage = await readTxn.timelineEvents.getByEventId(roomId, "!abc");
            await readTxn.complete();
            assert.equal(storedMessage.annotations["🐶"].count, 1);
        },
        
    }
}
