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

import {ViewModel} from "./ViewModel.js";
import {SessionLoadViewModel} from "./SessionLoadViewModel.js";

export class LoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {ready, defaultHomeServer, createSessionContainer} = options;
        this._createSessionContainer = createSessionContainer;
        this._ready = ready;
        this._defaultHomeServer = defaultHomeServer;
        this._sessionContainer = null;
        this._loadViewModel = null;
        this._loadViewModelSubscription = null;
    }

    get defaultHomeServer() { return this._defaultHomeServer; }

    get loadViewModel() {return this._loadViewModel; }

    get isBusy() {
        if (!this._loadViewModel) {
            return false;
        } else {
            return this._loadViewModel.loading;
        }
    }

    async login(username, password, homeserver) {
        this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
        if (this._loadViewModel) {
            this._loadViewModel = this.disposeTracked(this._loadViewModel);
        }
        this._loadViewModel = this.track(new SessionLoadViewModel(this.childOptions({
            createAndStartSessionContainer: () => {
                this._sessionContainer = this._createSessionContainer();
                this._sessionContainer.startWithLogin(homeserver, username, password);
                return this._sessionContainer;
            },
            ready: sessionContainer => {
                // make sure we don't delete the session in dispose when navigating away
                this._sessionContainer = null;
                this._ready(sessionContainer);
            },
            homeserver,
        })));
        this._loadViewModel.start();
        this.emitChange("loadViewModel");
        this._loadViewModelSubscription = this.track(this._loadViewModel.disposableOn("change", () => {
            if (!this._loadViewModel.loading) {
                this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
            }
            this.emitChange("isBusy");
        }));
    }

    get cancelUrl() {
        return this.urlCreator.urlForSegment("session");
    }

    dispose() {
        super.dispose();
        if (this._sessionContainer) {
            // if we move away before we're done with initial sync
            // delete the session
            this._sessionContainer.deleteSession();
        }
    }
}
