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

import {ViewModel} from "../../ViewModel.js";

export class ComposerViewModel extends ViewModel {
    constructor(roomVM) {
        super();
        this._roomVM = roomVM;
        this._isEmpty = true;
        this._replyVM = null;
    }

    setReplyingTo(entry) {
        const changed = this._replyVM?.internalId !== entry?.asEventKey().toString();
        if (changed) {
            this._replyVM = this.disposeTracked(this._replyVM);
            if (entry) {
                this._replyVM = this.track(this._roomVM._createTile(entry));
            }
            this.emitChange("replyViewModel");
            this.emit("focus");
        }
    }

    clearReplyingTo() {
        this.setReplyingTo(null);
    }

    get replyViewModel() {
        return this._replyVM;
    }

    get isEncrypted() {
        return this._roomVM.isEncrypted;
    }

    async sendMessage(message) {
        const success = await this._roomVM._sendMessage(message, this._replyVM);
        if (success) {
            this._isEmpty = true;
            this.emitChange("canSend");
            this.clearReplyingTo();
        }
        return success;
    }

    sendPicture() {
        this._roomVM._pickAndSendPicture();
    }

    sendFile() {
        this._roomVM._pickAndSendFile();
    }

    sendVideo() {
        this._roomVM._pickAndSendVideo();
    }

    get canSend() {
        return !this._isEmpty;
    }

    async setInput(text) {
        const wasEmpty = this._isEmpty;
        this._isEmpty = text.length === 0;
        if (wasEmpty && !this._isEmpty) {
            this._roomVM._room.ensureMessageKeyIsShared();
        }
        if (wasEmpty !== this._isEmpty) {
            this.emitChange("canSend");
        }
    }

    get kind() {
        return "composer";
    }
}
