import {ViewModel} from "../../ViewModel.js";

export class ComposerViewModel extends ViewModel {
    constructor(roomVM) {
        super();
        this._roomVM = roomVM;
        this._isEmpty = true;
        this._replyId = null;
        this._replyVM = null;
    }

    setReplyingTo(entry) {
        const newId = entry?.id || null;
        const changed = this._replyId !== newId;
        if (changed) {
            this._replyId = newId;
            if (this._replyVM) {
                this.untrack(this._replyVM);
                this._replyVM.dispose();
            }
            this._replyVM = entry && this._roomVM._createTile(entry);
            if (this._replyVM) {
                this.track(this._replyVM);
            }
            this.emitChange("replyViewModel");
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

    sendMessage(message) {
        const success = this._roomVM._sendMessage(message, this._replyVM);
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
