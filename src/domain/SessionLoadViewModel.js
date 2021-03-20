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

import {LoadStatus, LoginFailure} from "../matrix/SessionContainer.js";
import {SyncStatus} from "../matrix/Sync.js";
import {ViewModel} from "./ViewModel.js";

export class SessionLoadViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {createAndStartSessionContainer, ready, homeserver, deleteSessionOnCancel} = options;
        this._createAndStartSessionContainer = createAndStartSessionContainer;
        this._ready = ready;
        this._homeserver = homeserver;
        this._deleteSessionOnCancel = deleteSessionOnCancel;
        this._loading = false;
        this._error = null;
    }

    async start() {
        if (this._loading) {
            return;
        }
        try {
            this._loading = true;
            this.emitChange("loading");
            this._sessionContainer = this._createAndStartSessionContainer();
            this._waitHandle = this._sessionContainer.loadStatus.waitFor(s => {
                this.emitChange("loadLabel");
                // wait for initial sync, but not catchup sync
                const isCatchupSync = s === LoadStatus.FirstSync &&
                    this._sessionContainer.sync.status.get() === SyncStatus.CatchupSync;
                return isCatchupSync ||
                    s === LoadStatus.LoginFailed ||
                    s === LoadStatus.Error ||
                    s === LoadStatus.Ready ||
                    s === LoadStatus.LoginFlowsLoaded;
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
            const loadStatus = this._sessionContainer.loadStatus.get();
            const loadError = this._sessionContainer.loadError;
            const isReady =
                loadStatus === LoadStatus.FirstSync ||
                loadStatus === LoadStatus.Ready ||
                loadStatus === LoadStatus.LoginFlowsLoaded;
            if (isReady) {
                const sessionContainer = this._sessionContainer;

                this._ready(sessionContainer);
                this.emitChange("loadLabel");
            }
            if (loadError) {
                console.error("session load error", loadError);
            }
        } catch (err) {
            this._error = err;
            console.error("error thrown during session load", err.stack);
        } finally {
            this._loading = false;
            // loadLabel in case of sc.loadError also gets updated through this
            this.emitChange("loading");

            // session container is ready,
            // don't dispose it anymore when
            // we get disposed
            this._sessionContainer = null;
        }
    }


    dispose() {
        if (this._sessionContainer) {
            this._sessionContainer.dispose();
            this._sessionContainer = null;
        }
        if (this._waitHandle) {
            // rejects with AbortError
            this._waitHandle.dispose();
            this._waitHandle = null;
        }
    }

    // to show a spinner or not
    get loading() {
        return this._loading;
    }

    get loadLabel() {
        const sc = this._sessionContainer;
        const error = this._error || (sc && sc.loadError);

        if (error || (sc && sc.loadStatus.get() === LoadStatus.Error)) {
            return `Something went wrong: ${error && error.message}.`;
        }

        if (sc) {
            switch (sc.loadStatus.get()) {
                case LoadStatus.NotLoading:
                    return `Preparing…`;
                case LoadStatus.Login:
                    return `Checking your login and password…`;
                case LoadStatus.LoginFailed:
                    switch (sc.loginFailure) {
                        case LoginFailure.LoginFailure:
                            return `Your username and/or password don't seem to be correct.`;
                        case LoginFailure.Connection:
                            return `Can't connect to ${this._homeserver}.`;
                        case LoginFailure.Unknown:
                            return `Something went wrong while checking your login and password.`;
                    }
                    break;
                case LoadStatus.SessionSetup:
                    return `Setting up your encryption keys…`;
                case LoadStatus.Loading:
                    return `Loading your conversations…`;
                case LoadStatus.FirstSync:
                    return `Getting your conversations from the server…`;
                case LoadStatus.LoginFlowsLoaded:
                    return `Now You Can login`;
                default:
                    return this._sessionContainer.loadStatus.get();
            }
        }
        return `Preparing…`;
    }
}
