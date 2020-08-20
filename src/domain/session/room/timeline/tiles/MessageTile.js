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

import {SimpleTile} from "./SimpleTile.js";
import {getIdentifierColorNumber, avatarInitials} from "../../../../avatar.js";

export class MessageTile extends SimpleTile {
    constructor(options) {
        super(options);
        this._mediaRepository = options.mediaRepository;
        this._clock = options.clock;
        this._isOwn = this._entry.sender === options.ownUserId;
        this._date = this._entry.timestamp ? new Date(this._entry.timestamp) : null;
        this._isContinuation = false;
    }

    get shape() {
        return "message";
    }

    get sender() {
        return this._entry.displayName || this._entry.sender;
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber(this._entry.sender);
    }

    get avatarUrl() {
        if (this._entry.avatarUrl) {
            return this._mediaRepository.mxcUrlThumbnail(this._entry.avatarUrl, 30, 30, "crop");
        }
        return null;
    }

    get avatarLetter() {
        return avatarInitials(this.sender);
    }

    get date() {
        return this._date && this._date.toLocaleDateString({}, {month: "numeric", day: "numeric"});
    }

    get time() {
        return this._date && this._date.toLocaleTimeString({}, {hour: "numeric", minute: "2-digit"});
    }

    get isOwn() {
        return this._isOwn;
    }

    get isContinuation() {
        return this._isContinuation;
    }

    _getContent() {
        return this._entry.content;
    }

    updatePreviousSibling(prev) {
        super.updatePreviousSibling(prev);
        let isContinuation = false;
        if (prev && prev instanceof MessageTile && prev.sender === this.sender) {
            // timestamp is null for pending events
            const myTimestamp = this._entry.timestamp || this._clock.now();
            const otherTimestamp = prev._entry.timestamp || this._clock.now();
            // other message was sent less than 5min ago
            isContinuation = (myTimestamp - otherTimestamp) < (5 * 60 * 1000);
        }
        if (isContinuation !== this._isContinuation) {
            this._isContinuation = isContinuation;
            this.emitChange("isContinuation");
        }
    }
}
