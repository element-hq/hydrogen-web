import {EventEmitter} from "../../EventEmitter.js";

export class SyncStatusViewModel extends EventEmitter {
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
        this.emit("change");
    }

    onFirstSubscriptionAdded(name) {
        if (name === "change") {
            this._sync.on("status", this._onStatus);
        }
    }

    onLastSubscriptionRemoved(name) {
        if (name === "change") {
            this._sync.on("status", this._onStatus);
        }
    }

    trySync() {
        this._sync.start();
        this.emit("change");
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
