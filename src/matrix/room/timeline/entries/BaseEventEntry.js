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

import {BaseEntry} from "./BaseEntry.js";
import {REDACTION_TYPE} from "../../common.js";
import {createAnnotation, ANNOTATION_RELATION_TYPE, getRelationFromContent} from "../relations.js";
import {PendingAnnotations} from "../PendingAnnotations.js";

/** Deals mainly with local echo for relations and redactions,
 * so it is shared between PendingEventEntry and EventEntry */
export class BaseEventEntry extends BaseEntry {
    constructor(fragmentIdComparer) {
        super(fragmentIdComparer);
        this._pendingRedactions = null;
        this._pendingAnnotations = null;
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

    /**
        aggregates local relation or local redaction of remote relation.
        @return [string] returns the name of the field that has changed, if any
    */
    addLocalRelation(entry) {
        if (entry.eventType === REDACTION_TYPE && entry.relatedEventId === this.id) {
            if (!this._pendingRedactions) {
                this._pendingRedactions = [];
            }
            this._pendingRedactions.push(entry);
            if (this._pendingRedactions.length === 1) {
                return "isRedacted";
            }
        } else {
            const relationEntry = entry.redactingEntry || entry;
            if (relationEntry.isRelationForId(this.id)) {
                if (relationEntry.relation.rel_type === ANNOTATION_RELATION_TYPE) {
                    if (!this._pendingAnnotations) {
                        this._pendingAnnotations = new PendingAnnotations();
                    }
                    this._pendingAnnotations.add(entry);
                    return "pendingAnnotations";
                }
            }
        }
    }
    
    /**
        deaggregates local relation or a local redaction of a remote relation.
        @return [string] returns the name of the field that has changed, if any
    */
    removeLocalRelation(entry) {
        if (entry.eventType === REDACTION_TYPE && entry.relatedEventId === this.id && this._pendingRedactions) {
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
            if (relationEntry.isRelationForId(this.id)) {
                if (relationEntry.relation.rel_type === ANNOTATION_RELATION_TYPE && this._pendingAnnotations) {
                    this._pendingAnnotations.remove(entry);
                    if (this._pendingAnnotations.isEmpty) {
                        this._pendingAnnotations = null;
                    }
                    return "pendingAnnotations";
                }
            }
        }
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

    isRelationForId(id) {
        return id && this.relation?.event_id === id;
    }

    get relation() {
        return getRelationFromContent(this.content);
    }

    get pendingAnnotations() {
        return this._pendingAnnotations?.aggregatedAnnotations;
    }

    async getOwnAnnotationEntry(timeline, key) {
        return this._pendingAnnotations?.findForKey(key);
    }

    getAnnotationPendingRedaction(key) {
        return this._pendingAnnotations?.findRedactionForKey(key);
    }
}
