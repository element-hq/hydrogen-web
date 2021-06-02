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
import {getIdentifierColorNumber, avatarInitials, getAvatarHttpUrl} from "../../../../avatar.js";

export class BaseMessageTile extends SimpleTile {
    constructor(options) {
        super(options);
        this._date = this._entry.timestamp ? new Date(this._entry.timestamp) : null;
        this._isContinuation = false;
    }

    get _room() {
        return this.getOption("room");
    }

    get _mediaRepository() {
        return this._room.mediaRepository;
    }

    get displayName() {
        return this._entry.displayName || this.sender;
    }

    get sender() {
        return this._entry.sender;
    }

    // Avatar view model contract
    get avatarColorNumber() {
        return getIdentifierColorNumber(this._entry.sender);
    }

    avatarUrl(size) {
        return getAvatarHttpUrl(this._entry.avatarUrl, size, this.platform, this._mediaRepository);
    }

    get avatarLetter() {
        return avatarInitials(this.sender);
    }

    get avatarTitle() {
        return this.displayName;
    }

    get date() {
        return this._date && this._date.toLocaleDateString({}, {month: "numeric", day: "numeric"});
    }

    get time() {
        return this._date && this._date.toLocaleTimeString({}, {hour: "numeric", minute: "2-digit"});
    }

    get isOwn() {
        return this._entry.sender === this._ownMember.userId;
    }

    get isContinuation() {
        return this._isContinuation;
    }

    get isUnverified() {
        return this._entry.isUnverified;
    }

    _getContent() {
        return this._entry.content;
    }

    updatePreviousSibling(prev) {
        super.updatePreviousSibling(prev);
        let isContinuation = false;
        if (prev && prev instanceof BaseMessageTile && prev.sender === this.sender) {
            // timestamp is null for pending events
            const myTimestamp = this._entry.timestamp;
            const otherTimestamp = prev._entry.timestamp;
            // other message was sent less than 5min ago
            isContinuation = (myTimestamp - otherTimestamp) < (5 * 60 * 1000);
        }
        if (isContinuation !== this._isContinuation) {
            this._isContinuation = isContinuation;
            this.emitChange("isContinuation");
        }
    }

    redact(reason, log) {
        return this._room.sendRedaction(this._entry.id, reason, log);
    }

    get canRedact() {
        return this._powerLevels.canRedactFromSender(this._entry.sender);
    }
}
