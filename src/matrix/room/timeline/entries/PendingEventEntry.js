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

import {PENDING_FRAGMENT_ID} from "./BaseEntry";
import {BaseEventEntry} from "./BaseEventEntry.js";

export class PendingEventEntry extends BaseEventEntry {
    constructor({pendingEvent, member, clock, redactingEntry}) {
        super(null);
        this._pendingEvent = pendingEvent;
        /** @type {RoomMember} */
        this._member = member;
        // try to come up with a timestamp that is around construction time and
        // will be roughly sorted by queueIndex, so it can be used to as a secondary
        // sorting dimension for reactions
        this._timestamp = clock.now() - (100 - pendingEvent.queueIndex);
        this._redactingEntry = redactingEntry;
    }

    get fragmentId() {
        return PENDING_FRAGMENT_ID;
    }

    get entryIndex() {
        return this._pendingEvent.queueIndex;
    }

    get content() {
        return this._pendingEvent.content;
    }

    get event() {
        return null;
    }

    get eventType() {
        return this._pendingEvent.eventType;
    }

    get stateKey() {
        return null;
    }

    get sender() {
        return this._member?.userId;
    }

    get displayName() {
        return this._member?.name;
    }

    get avatarUrl() {
        return this._member?.avatarUrl;
    }

    get timestamp() {
        return this._timestamp;
    }

    get isPending() {
        return true;
    }

    get id() {
        return this._pendingEvent.txnId;
    }

    get pendingEvent() {
        return this._pendingEvent;
    }

    notifyUpdate() {
        
    }

    isRelatedToId(id) {
        if (id && id === this._pendingEvent.relatedTxnId) {
            return true;
        }
        return super.isRelatedToId(id);
    }

    get relatedEventId() {
        return this._pendingEvent.relatedEventId;
    }

    get redactingEntry() {
        return this._redactingEntry;
    }
}
