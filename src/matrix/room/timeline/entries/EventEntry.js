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

import {BaseEntry} from "./BaseEntry.js";

export class EventEntry extends BaseEntry {
    constructor(eventEntry, fragmentIdComparer) {
        super(fragmentIdComparer);
        this._eventEntry = eventEntry;
    }

    get fragmentId() {
        return this._eventEntry.fragmentId;
    }

    get entryIndex() {
        return this._eventEntry.eventIndex;
    }

    get content() {
        return this._eventEntry.event.content;
    }

    get prevContent() {
        return this._eventEntry.event.unsigned?.prev_content;
    }

    get eventType() {
        return this._eventEntry.event.type;
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
}
