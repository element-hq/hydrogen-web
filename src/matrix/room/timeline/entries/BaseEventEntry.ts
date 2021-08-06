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

import {FragmentIdComparer, BaseEntry} from "./BaseEntry";
import {PendingEventEntry} from "./PendingEventEntry.js"
import {REDACTION_TYPE} from "../../common.js";
import {createAnnotation, ANNOTATION_RELATION_TYPE, getRelationFromContent} from "../relations.js";
import {PendingAnnotation} from "../PendingAnnotation.js";

export interface Annotation {
    count: number,
    me: boolean,
    firstTimestamp: number
}

/** Deals mainly with local echo for relations and redactions,
 * so it is shared between PendingEventEntry and EventEntry */
export abstract class BaseEventEntry extends BaseEntry {
    private _pendingRedactions: Array<PendingEventEntry> | null
    private _pendingAnnotations: Map<string, PendingAnnotation> | null

    abstract id: string
    abstract relatedEventId: string
    abstract eventType: string
    abstract content: any
    
    constructor(fragmentIdComparer: FragmentIdComparer) {
        super(fragmentIdComparer);
        this._pendingRedactions = null;
        this._pendingAnnotations = null;
    }

    get isRedacting(): boolean {
        return !!this._pendingRedactions;
    }

    get isRedacted(): boolean {
        return this.isRedacting;
    }

    get isRedaction(): boolean {
        return this.eventType === REDACTION_TYPE;
    }

    get redactionReason(): string | null {
        if (this._pendingRedactions) {
            return this._pendingRedactions[0].content?.reason;
        }
        return null;
    }

    /**
        aggregates local relation or local redaction of remote relation.
        @return [string] returns the name of the field that has changed, if any
    */
    addLocalRelation(entry: PendingEventEntry): string | undefined {
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
    removeLocalRelation(entry: PendingEventEntry): string | undefined {
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

    _addPendingAnnotation(entry: PendingEventEntry): boolean {
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

    _removePendingAnnotation(entry: PendingEventEntry) {
        const {key} = (entry.redactingEntry || entry).relation;
        if (key) {
            let annotation = this._pendingAnnotations?.get(key);
            if (annotation.remove(entry) && annotation.isEmpty) {
                this._pendingAnnotations?.delete(key);
            }
            if (this._pendingAnnotations?.size === 0) {
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

    get pendingRedaction(): PendingEventEntry | null {
        if (this._pendingRedactions) {
            return this._pendingRedactions[0];
        }
        return null;
    }

    annotate(key: string): any {
        return createAnnotation(this.id, key);
    }

    /** takes both remote event id and local txn id into account, see overriding in PendingEventEntry */
    isRelatedToId(id: string | null): boolean {
        return !!id && this.relatedEventId === id;
    }

    haveAnnotation(key: string): boolean {
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

    get relation(): any {
        return getRelationFromContent(this.content);
    }

    get pendingAnnotations(): Map<string, PendingAnnotation> | null {
        return this._pendingAnnotations;
    }

    get annotations(): { [key: string]: Annotation } | null {
        return null; //overwritten in EventEntry
    }
}
