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

import {ViewModel} from "../ViewModel.js";
import {SessionLoadViewModel} from "../SessionLoadViewModel.js";

export class PasswordLoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {ready, loginOptions, sessionContainer, homeserver} = options;
        this._ready = ready;
        this._sessionContainer = sessionContainer;
        this._loadViewModel = null;
        this._loadViewModelSubscription = null;
        this._loginOptions = loginOptions;
        this._homeserver = homeserver;
    }

    get loadViewModel() {return this._loadViewModel; }
    get cancelUrl() { return this.urlCreator.urlForSegment("session"); }

    get isBusy() {
        if (!this._loadViewModel) {
            return false;
        } else {
            return this._loadViewModel.loading;
        }
    }

    async login(username, password) {
        const homeserver = this._homeserver;
        this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
        if (this._loadViewModel) {
            this._loadViewModel = this.disposeTracked(this._loadViewModel);
        }
        this._loadViewModel = this.track(new SessionLoadViewModel(this.childOptions({
            createAndStartSessionContainer: async () => {
                this._sessionContainer.startWithLogin(this._loginOptions.password(username, password));
                return this._sessionContainer;
            },
            ready: this._ready,
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
}
