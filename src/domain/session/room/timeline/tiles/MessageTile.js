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
import {getIdentifierColorNumber} from "../../../../avatar.js";

export class MessageTile extends SimpleTile {
    constructor(options) {
        super(options);
        this._isOwn = this._entry.sender === options.ownUserId;
        this._date = new Date(this._entry.timestamp);
        this._isContinuation = false;
    }

    get shape() {
        return "message";
    }

    get sender() {
        return this._entry.sender;
    }

    get senderColorNumber() {
        return getIdentifierColorNumber(this._entry.sender);
    }

    get date() {
        return this._date.toLocaleDateString({}, {month: "numeric", day: "numeric"});
    }

    get time() {
        return this._date.toLocaleTimeString({}, {hour: "numeric", minute: "2-digit"});
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
        const isContinuation = prev && prev instanceof MessageTile && prev.sender === this.sender;
        if (isContinuation !== this._isContinuation) {
            this._isContinuation = isContinuation;
            this.emitChange("isContinuation");
        }
    }
}
