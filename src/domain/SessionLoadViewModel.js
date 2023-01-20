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

import {AccountSetupViewModel} from "./AccountSetupViewModel.js";
import {LoadStatus} from "../matrix/Client.js";
import {SyncStatus} from "../matrix/Sync.js";
import {ViewModel} from "./ViewModel";

export class SessionLoadViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {client, ready, homeserver, deleteSessionOnCancel} = options;
        this._client = client;
        this._ready = ready;
        this._homeserver = homeserver;
        this._deleteSessionOnCancel = deleteSessionOnCancel;
        this._loading = false;
        this._error = null;
        this.backUrl = this.urlRouter.urlForSegment("session", true);
        this._accountSetupViewModel = undefined;

    }

    async start() {
        if (this._loading) {
            return;
        }
        try {
            this._loading = true;
            this.emitChange("loading");
            this._waitHandle = this._client.loadStatus.waitFor(s => {
                if (s === LoadStatus.AccountSetup) {
                    this._accountSetupViewModel = new AccountSetupViewModel(this.childOptions({accountSetup: this._client.accountSetup}));
                } else {
                    this._accountSetupViewModel = undefined;
                }
                this.emitChange("loadLabel");
                // wait for initial sync, but not catchup sync
                const isCatchupSync = s === LoadStatus.FirstSync &&
                    this._client.sync.status.get() === SyncStatus.CatchupSync;
                return isCatchupSync ||
                    s === LoadStatus.LoginFailed ||
                    s === LoadStatus.Error ||
                    s === LoadStatus.Ready;
            });
            try {
                await this._waitHandle.promise;
            } catch (err) {
                return; // aborted by goBack
            }
            // TODO: should we deal with no connection during initial sync 
            // and we're retrying as well here?
            // e.g. show in the label what is going on wrt connectionstatus
            // much like we will once you are in the app. Probably a good idea

            // did it finish or get stuck at LoginFailed or Error?
            const loadStatus = this._client.loadStatus.get();
            const loadError = this._client.loadError;
            if (loadStatus === LoadStatus.FirstSync || loadStatus === LoadStatus.Ready) {
                const client = this._client;
                // session container is ready,
                // don't dispose it anymore when 
                // we get disposed
                this._client = null;
                this._ready(client);
            }
            if (loadError) {
                console.error("session load error", loadError);
            }
        } catch (err) {
            this._error = err;
            console.error("error thrown during session load", err.stack);
        } finally {
            this._loading = false;
            // loadLabel in case of client.loadError also gets updated through this
            this.emitChange("loading");
        }
    }


    dispose() {
        if (this._client) {
            this._client.dispose();
            this._client = null;
        }
        if (this._waitHandle) {
            // rejects with AbortError
            this._waitHandle.dispose();
            this._waitHandle = null;
        }
    }

    // to show a spinner or not
    get loading() {
        const client = this._client;
        if (client && client.loadStatus.get() === LoadStatus.AccountSetup) {
            return false;
        }
        return this._loading;
    }

    get loadLabel() {
        const client = this._client;
        const error = this._getError();
        if (error || (client && client.loadStatus.get() === LoadStatus.Error)) {
            return `Something went wrong: ${error && error.message}.`;
        }

        // Statuses related to login are handled by respective login view models
        if (client) {
            switch (client.loadStatus.get()) {
                case LoadStatus.QueryAccount:
                    return `Querying account encryption setup…`;
                case LoadStatus.AccountSetup:
                    return ""; // we'll show a header ing AccountSetupView
                case LoadStatus.SessionSetup:
                    return `Setting up your encryption keys…`;
                case LoadStatus.Loading:
                    return `Loading your conversations…`;
                case LoadStatus.FirstSync:
                    return `Getting your conversations from the server…`;
                default:
                    return this._client.loadStatus.get();
            }
        }

        return `Preparing…`;
    }

    _getError() {
        return this._error || this._client?.loadError; 
    }

    get hasError() {
        return !!this._getError();
    }

    async exportLogs() {
        const logExport = await this.logger.export();
        this.platform.saveFileAs(logExport.asBlob(), `hydrogen-logs-${this.platform.clock.now()}.json`);
    }

    async logout() {
        await this._client.startLogout(this.navigation.path.get("session").value);
        this.navigation.push("session", true);
    }

    get accountSetupViewModel() {
        return this._accountSetupViewModel;
    }
}
