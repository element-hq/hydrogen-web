/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ViewModel} from "../../ViewModel";

export class ComposerViewModel extends ViewModel {
    constructor(roomVM) {
        super(roomVM.options);
        this._roomVM = roomVM;
        this._isEmpty = true;
        this._replyVM = null;
    }

    setReplyingTo(entry) {
        const changed = new Boolean(entry) !== new Boolean(this._replyVM) || !this._replyVM?.id.equals(entry.asEventKey());
        if (changed) {
            this._replyVM = this.disposeTracked(this._replyVM);
            if (entry) {
                this._replyVM = this.track(this._roomVM._createTile(entry));
                this._replyVM.notifyVisible();
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
