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

import {ViewModel} from "../ViewModel";
import {createEnum} from "../../utils/enum";
import {ConnectionStatus} from "../../matrix/net/Reconnector";
import {SyncStatus} from "../../matrix/Sync.js";

const SessionStatus = createEnum(
    "Disconnected",
    "Connecting",
    "FirstSync",
    "Sending",
    "Syncing",
    "SyncError"
);

export class SessionStatusViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {sync, reconnector, session} = options;
        this._sync = sync;
        this._reconnector = reconnector;
        this._status = this._calculateState(reconnector.connectionStatus.get(), sync.status.get());
        this._session = session;
        this._setupKeyBackupUrl = this.urlRouter.urlForSegment("settings");
        this._dismissSecretStorage = false;
    }

    start() {
        const update = () => this._updateStatus();
        this.track(this._sync.status.subscribe(update));
        this.track(this._reconnector.connectionStatus.subscribe(update));
        this.track(this._session.needsKeyBackup.subscribe(() => {
            this.emitChange();
        }));
    }

    get setupKeyBackupUrl () {
        return this._setupKeyBackupUrl;
    }

    get isShown() {
        return (this._session.needsKeyBackup.get() && !this._dismissSecretStorage) || this._status !== SessionStatus.Syncing;
    }

    get statusLabel() {
        switch (this._status) {
            case SessionStatus.Disconnected:{
                const retryIn = Math.round(this._reconnector.retryIn / 1000);
                return this.i18n`Disconnected, trying to reconnect in ${retryIn}s…`;
            }
            case SessionStatus.Connecting:
                return this.i18n`Trying to reconnect now…`;
            case SessionStatus.FirstSync:
                return this.i18n`Catching up with your conversations…`;
            case SessionStatus.SyncError:
                return this.i18n`Sync failed because of ${this._sync.error}`;
        }
        if (this._session.needsKeyBackup.get()) {
            return this.i18n`Set up session backup to decrypt older messages.`;
        }
        return "";
    }

    get isWaiting() {
        switch (this._status) {
            case SessionStatus.Connecting:
            case SessionStatus.FirstSync:
                return true;
            default:
                return false;
        }
    }

    _updateStatus() {
        const newStatus = this._calculateState(
            this._reconnector.connectionStatus.get(),
            this._sync.status.get()
        );
        if (newStatus !== this._status) {
            if (newStatus === SessionStatus.Disconnected) {
                this._retryTimer = this.track(this.clock.createInterval(() => {
                    this.emitChange("statusLabel");
                }, 1000));
            } else {
                this._retryTimer = this.disposeTracked(this._retryTimer);
            }
            this._status = newStatus;
            this.emitChange();
        }
    }

    _calculateState(connectionStatus, syncStatus) {
        if (connectionStatus !== ConnectionStatus.Online) {
            switch (connectionStatus) {
                case ConnectionStatus.Reconnecting:
                    return SessionStatus.Connecting;
                case ConnectionStatus.Waiting:
                    return SessionStatus.Disconnected;
            }
        } else if (syncStatus !== SyncStatus.Syncing) {
            switch (syncStatus) {
                // InitialSync should be awaited in the SessionLoadViewModel,
                // but include it here anyway
                case SyncStatus.InitialSync:
                case SyncStatus.CatchupSync:
                    return SessionStatus.FirstSync;
                case SyncStatus.Stopped:
                    return SessionStatus.SyncError;
            }
        } /* else if (session.pendingMessageCount) {
            return SessionStatus.Sending;
        } */ else {
            return SessionStatus.Syncing;
        }
    }

    get isConnectNowShown() {
        return this._status === SessionStatus.Disconnected;
    }

    get isSecretStorageShown() {
        // TODO: we need a model here where we can have multiple messages queued up and their buttons don't bleed into each other.
        return this._status === SessionStatus.Syncing && this._session.needsKeyBackup.get() && !this._dismissSecretStorage;
    }

    get canDismiss() {
        return this.isSecretStorageShown;
    }

    dismiss() {
        if (this.isSecretStorageShown) {
            this._dismissSecretStorage = true;
            this.emitChange();
        }
    }

    connectNow() {
        if (this.isConnectNowShown) {
            this._reconnector.tryNow();
        }
    }
}
