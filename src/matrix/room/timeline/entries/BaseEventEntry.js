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

import {BaseEntry} from "./BaseEntry";
import {REDACTION_TYPE} from "../../common";
import {createAnnotation, ANNOTATION_RELATION_TYPE, getRelationFromContent} from "../relations.js";
import {PendingAnnotation} from "../PendingAnnotation.js";
import {createReplyContent} from "./reply.js"

/** Deals mainly with local echo for relations and redactions,
 * so it is shared between PendingEventEntry and EventEntry */
export class BaseEventEntry extends BaseEntry {
    constructor(fragmentIdComparer) {
        super(fragmentIdComparer);
        this._pendingRedactions = null;
        this._pendingAnnotations = null;
        this._contextEntry = null;
        this._contextForEntries = null;
    }

    get isReply() {
        return !!this.relation?.["m.in_reply_to"];
    }

    get isRedacting() {
        return !!this._pendingRedactions;
    }

    get isRedacted() {
        return this.isRedacting;
    }

    get isRedaction() {
        return this.eventType === REDACTION_TYPE;
    }

    get redactionReason() {
        if (this._pendingRedactions) {
            return this._pendingRedactions[0].content?.reason;
        }
        return null;
    }

    setContextEntry(entry) {
        this._contextEntry = entry;
        entry._setAsContextOf(this);
    }

    _setAsContextOf(entry) {
        if (!this._contextForEntries) {
            this._contextForEntries = [];
        }
        this._contextForEntries.push(entry);
    }

    get contextForEntries() {
        return this._contextForEntries;
    }

    get contextEntry() {
        return this._contextEntry;
    }

    /**
        Aggregates relation or redaction of remote relation.  
        Used in two situations:
        - to aggregate local relation/redaction of remote relation
        - to mark this entry as being redacted in Timeline._updateEntriesFetchedFromHomeserver
        @return [string] returns the name of the field that has changed, if any
    */
    addLocalRelation(entry) {
        if (entry.eventType === REDACTION_TYPE && entry.isRelatedToId(this.id)) {
            if (!this._pendingRedactions) {
                this._pendingRedactions = [];
            }
            this._pendingRedactions.push(entry);
            if (this._pendingRedactions.length === 1) {
                return "isRedacted";
            }
        } else {
            const relationEntry = entry.redactingEntry || entry;
            if (relationEntry.isRelatedToId(this.id)) {
                if (relationEntry.relation.rel_type === ANNOTATION_RELATION_TYPE) {
                    if (this._addPendingAnnotation(entry)) {
                        return "pendingAnnotations";
                    }
                }
            }
        }
    }
    
    /**
        deaggregates local relation or a local redaction of a remote relation.
        @return [string] returns the name of the field that has changed, if any
    */
    removeLocalRelation(entry) {
        if (entry.eventType === REDACTION_TYPE && entry.isRelatedToId(this.id) && this._pendingRedactions) {
            const countBefore = this._pendingRedactions.length;
            this._pendingRedactions = this._pendingRedactions.filter(e => e !== entry);
            if (this._pendingRedactions.length === 0) {
                this._pendingRedactions = null;
                if (countBefore !== 0) {
                    return "isRedacted";
                }
            }
        } else {
            const relationEntry = entry.redactingEntry || entry;
            if (relationEntry.isRelatedToId(this.id)) {
                if (relationEntry.relation?.rel_type === ANNOTATION_RELATION_TYPE && this._pendingAnnotations) {
                    if (this._removePendingAnnotation(entry)) {
                        return "pendingAnnotations";
                    }
                }
            }
        }
    }

    _addPendingAnnotation(entry) {
        if (!this._pendingAnnotations) {
            this._pendingAnnotations = new Map();
        }
        const {key} = (entry.redactingEntry || entry).relation;
        if (key) {
            let annotation = this._pendingAnnotations.get(key);
            if (!annotation) {
                annotation = new PendingAnnotation();
                this._pendingAnnotations.set(key, annotation);
            }
            annotation.add(entry);
            return true;
        }
        return false;
    }

    _removePendingAnnotation(entry) {
        const {key} = (entry.redactingEntry || entry).relation;
        if (key) {
            let annotation = this._pendingAnnotations.get(key);
            if (annotation.remove(entry) && annotation.isEmpty) {
                this._pendingAnnotations.delete(key);
            }
            if (this._pendingAnnotations.size === 0) {
                this._pendingAnnotations = null;
            }
            return true;
        }
        return false;
    }

    async abortPendingRedaction() {
        if (this._pendingRedactions) {
            for (const pee of this._pendingRedactions) {
                await pee.pendingEvent.abort();
            }
            // removing the pending events will call removeLocalRelation,
            // so don't clear _pendingRedactions here
        }
    }

    get pendingRedaction() {
        if (this._pendingRedactions) {
            return this._pendingRedactions[0];
        }
        return null;
    }

    annotate(key) {
        return createAnnotation(this.id, key);
    }

    createReplyContent(msgtype, body) {
        return createReplyContent(this, msgtype, body);
    }

    /** takes both remote event id and local txn id into account, see overriding in PendingEventEntry */
    isRelatedToId(id) {
        return id && this.relatedEventId === id;
    }

    haveAnnotation(key) {
        const haveRemoteReaction = this.annotations?.[key]?.me || false;
        const pendingAnnotation = this.pendingAnnotations?.get(key);
        const willAnnotate = pendingAnnotation?.willAnnotate || false;
        /*
        We have an annotation in these case:
        - remote annotation with me, no pending
        - remote annotation with me, pending redaction and then annotation
        - pending annotation without redaction after it
        */
        return (haveRemoteReaction && (!pendingAnnotation || willAnnotate)) ||
            (!haveRemoteReaction && willAnnotate);
    }

    get relation() {
        return getRelationFromContent(this.content);
    }

    get pendingAnnotations() {
        return this._pendingAnnotations;
    }

    get annotations() {
        return null; //overwritten in EventEntry
    }
}
