import {ViewModel} from "../../ViewModel.js";

export class ComposerViewModel extends ViewModel {
    constructor(roomVM) {
        super();
        this._roomVM = roomVM;
        this._isEmpty = true;
        this._replyVM = null;
        this._replySub = null;
        this._replyingToId = null;
    }

    setReplyingTo(id) {
        if (this._replyingToId === id) {
            return;
        }
        this._replyingToId = id;
        // Dispose of event subscription
        if (this._replySub) {
            this._replySub();
            this.untrack(this._replySub);
        }
        // replyVM may not be created yet even if subscribed.
        if (this._replyVM) {
            this._replyVM.dispose();
        }
        // Early return if we don't have an ID to reply to.
        if (!id) {
            this._replyVM = null;
            this._replySub = null;
            this.emitChange("replyViewModel");
            return;
        }
        const observable = this._roomVM._observeEvent(id);
        const entry = observable.get();
        if (entry) {
            this._replyVM = this._roomVM._createTile(entry);
        }
        this._replySub = observable.subscribe(entry => {
            if (!this._replyVM) {
                this._replyVM = this._roomVM._createTile(entry);
            } else {
                this._replyVM.updateEntry(entry);
            }
            this.emitChange("replyViewModel");
        });
        this.track(this._replySub);
        this.emitChange("replyViewModel");
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
