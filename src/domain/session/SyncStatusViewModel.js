import {ViewModel} from "../ViewModel.js";

export class SyncStatusViewModel extends ViewModel {
    constructor(sync) {
        super();
        this._sync = sync;
        this._onStatus = this._onStatus.bind(this);
    }

    _onStatus(status, err) {
        if (status === "error") {
            this._error = err;
        } else if (status === "started") {
            this._error = null;
        }
        this.emitChange();
    }

    onFirstSubscriptionAdded(name) {
        if (name === "change") {
            //this._sync.status.("status", this._onStatus);
        }
    }

    onLastSubscriptionRemoved(name) {
        if (name === "change") {
            //this._sync.status.("status", this._onStatus);
        }
    }

    trySync() {
        this._sync.start();
        this.emitChange();
    }

    get status() {
        if (!this.isSyncing) {
            if (this._error) {
                return `Error while syncing: ${this._error.message}`;
            } else {
                return "Sync stopped";
            }
        } else {
            return "Sync running";
        }
    }

    get isSyncing() {
        return this._sync.isSyncing;
    }
}
