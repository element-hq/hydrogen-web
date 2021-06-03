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
import {REDACTION_TYPE} from "../../common.js";
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
            if (relation) {
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
        // TODO: check if sourceEntry is in timelineRelations as a target, and if so reaggregate it
        return null;
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
            if (relation) {
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
        if (relation) {
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