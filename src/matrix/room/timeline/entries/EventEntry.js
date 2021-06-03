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
import {getPrevContentFromStateEvent} from "../../common.js";

export class EventEntry extends BaseEventEntry {
    constructor(eventEntry, fragmentIdComparer) {
        super(fragmentIdComparer);
        this._eventEntry = eventEntry;
        this._decryptionError = null;
        this._decryptionResult = null;
    }

    clone() {
        const clone = new EventEntry(this._eventEntry, this._fragmentIdComparer);
        clone._decryptionResult = this._decryptionResult;
        clone._decryptionError = this._decryptionError;
        return clone;
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
        return this._eventEntry.event.redacts;
    }

    get isRedacted() {
        return super.isRedacted || !!this._eventEntry.event.unsigned?.redacted_because;
    }

    get redactionReason() {
        const redactionEvent = this._eventEntry.event.unsigned?.redacted_because;
        if (redactionEvent) {
            return redactionEvent.content?.reason;
        }
        // fall back to local echo reason
        return super.redactionReason;
    }
}