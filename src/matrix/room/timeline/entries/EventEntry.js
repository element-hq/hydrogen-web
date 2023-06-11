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

import {BaseEventEntry} from "./BaseEventEntry.js";
import {getPrevContentFromStateEvent, isRedacted} from "../../common";
import {getRelationFromContent, getRelatedEventId} from "../relations.js";

export class EventEntry extends BaseEventEntry {
    constructor(eventEntry, fragmentIdComparer) {
        super(fragmentIdComparer);
        this._eventEntry = eventEntry;
        this._decryptionError = null;
        this._decryptionResult = null;
    }

    clone() {
        const clone = new EventEntry(this._eventEntry, this._fragmentIdComparer);
        clone.updateFrom(this);
        return clone;
    }

    updateFrom(other) {
        // only update these when we attempted decryption, as some updates (like reactions) don't.
        if (other._decryptionResult) {
            this._decryptionResult = other._decryptionResult;
        }
        if (other._decryptionError) {
            this._decryptionError = other._decryptionError;
        }
        this._contextForEntries = other.contextForEntries;
        this._contextEntry = other.contextEntry;
    }

    get event() {
        return this._eventEntry.event;
    }

    get fragmentId() {
        return this._eventEntry.fragmentId;
    }

    get entryIndex() {
        return this._eventEntry.eventIndex;
    }

    get content() {
        return this._decryptionResult?.event?.content || this._eventEntry.event.content;
    }

    get prevContent() {
        // doesn't look at _decryptionResult because state events are not encrypted
        return getPrevContentFromStateEvent(this._eventEntry.event);
    }

    get eventType() {
        return this._decryptionResult?.event?.type || this._eventEntry.event.type;
    }

    get stateKey() {
        return this._eventEntry.event.state_key;
    }

    get sender() {
        return this._eventEntry.event.sender;
    }

    get displayName() {
        return this._eventEntry.displayName;
    }

    get avatarUrl() {
        return this._eventEntry.avatarUrl;
    }

    get timestamp() {
        return this._eventEntry.event.origin_server_ts;
    }

    get id() {
        return this._eventEntry.event.event_id;
    }

    setDecryptionResult(result) {
        this._decryptionResult = result;
    }

    get isEncrypted() {
        return this._eventEntry.event.type === "m.room.encrypted";
    }

    get isDecrypted() {
        return !!this._decryptionResult?.event;
    }

    get isVerified() {
        return this.isEncrypted && this._decryptionResult?.isVerified;
    }

    get isUnverified() {
        return this.isEncrypted && this._decryptionResult?.isUnverified;
    }

    setDecryptionError(err) {
        this._decryptionError = err;
    }

    get decryptionError() {
        return this._decryptionError;
    }

    get relatedEventId() {
        return getRelatedEventId(this.event);
    }

    get isRedacted() {
        return super.isRedacted || isRedacted(this._eventEntry.event);
    }

    get redactionReason() {
        const redactionEvent = this._eventEntry.event.unsigned?.redacted_because;
        if (redactionEvent) {
            return redactionEvent.content?.reason;
        }
        // fall back to local echo reason
        return super.redactionReason;
    }

    get annotations() {
        return this._eventEntry.annotations;
    }

    get relation() {
        const originalContent = this._eventEntry.event.content;
        const originalRelation = originalContent && getRelationFromContent(originalContent);
        return originalRelation || getRelationFromContent(this.content);
    }

    // similar to relatedEventID but only for replies and reference relations
    get contextEventId() {
        if (this.isReply || this.isReference) {
            return this.relatedEventId;
        }
        return null;
    }

}

import {withTextBody, withContent, createEvent} from "../../../../mocks/event.js";
import {Clock as MockClock} from "../../../../mocks/Clock.js";
import {PendingEventEntry} from "./PendingEventEntry.js";
import {PendingEvent} from "../../sending/PendingEvent.js";
import {createAnnotation} from "../relations.js";

export function tests() {
    let queueIndex = 0;
    const clock = new MockClock();

    function addPendingReaction(target, key) {
        queueIndex += 1;
        target.addLocalRelation(new PendingEventEntry({
            pendingEvent: new PendingEvent({data: {
                eventType: "m.reaction",
                content: createAnnotation(target.id, key),
                queueIndex,
                txnId: `t${queueIndex}`
            }}),
            clock
        }));
        return target;
    }

    function addPendingRedaction(target, key) {
        const pendingReaction = target.pendingAnnotations?.get(key)?.annotationEntry;
        let redactingEntry = pendingReaction;
        // make up a remote entry if we don't have a pending reaction and have an aggregated remote entry
        if (!pendingReaction && target.annotations[key].me) {
            redactingEntry = new EventEntry({
                event: withContent(createAnnotation(target.id, key), createEvent("m.reaction", "!def"))
            });
        }
        queueIndex += 1;
        target.addLocalRelation(new PendingEventEntry({
            pendingEvent: new PendingEvent({data: {
                eventType: "m.room.redaction",
                relatedTxnId: pendingReaction ? pendingReaction.id : null,
                relatedEventId: pendingReaction ? null : redactingEntry.id,
                queueIndex,
                txnId: `t${queueIndex}`
            }}),
            redactingEntry,
            clock
        }));
        return target;
    }

    function remoteAnnotation(key, me, count, obj = {}) {
        obj[key] = {me, count};
        return obj;
    }

    return {
        // testing it here because parent class always assumes annotations is null
        "haveAnnotation": assert => {
            const msgEvent = withTextBody("hi!", createEvent("m.room.message", "!abc"));
            const e1 = new EventEntry({event: msgEvent});
            assert.equal(false, e1.haveAnnotation("🚀"));
            const e2 = new EventEntry({event: msgEvent, annotations: remoteAnnotation("🚀", false, 1)});
            assert.equal(false, e2.haveAnnotation("🚀"));
            const e3 = new EventEntry({event: msgEvent, annotations: remoteAnnotation("🚀", true, 1)});
            assert.equal(true, e3.haveAnnotation("🚀"));
            const e4 = new EventEntry({event: msgEvent, annotations: remoteAnnotation("🚀", true, 2)});
            assert.equal(true, e4.haveAnnotation("🚀"));
            const e5 = addPendingReaction(new EventEntry({event: msgEvent}), "🚀");
            assert.equal(true, e5.haveAnnotation("🚀"));
            const e6 = addPendingRedaction(new EventEntry({event: msgEvent, annotations: remoteAnnotation("🚀", true, 1)}), "🚀");
            assert.equal(false, e6.haveAnnotation("🚀"));
            const e7 = addPendingReaction(
                addPendingRedaction(
                    new EventEntry({event: msgEvent, annotations: remoteAnnotation("🚀", true, 1)}),
                "🚀"),
            "🚀");
            assert.equal(true, e7.haveAnnotation("🚀"));
            const e8 = addPendingRedaction(
                addPendingReaction(
                    new EventEntry({event: msgEvent}),
                "🚀"),
            "🚀");
            assert.equal(false, e8.haveAnnotation("🚀"));
        }
    }
}
