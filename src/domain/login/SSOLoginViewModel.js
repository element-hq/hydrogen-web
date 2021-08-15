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

export class SSOLoginViewModel extends ViewModel{
    constructor(options) {
        super(options);
        const {
            loginToken,
            sessionContainer,
            loginOptions,
            ready,
            homeserver
        } = options;
        this._loginToken = loginToken;
        this._ready = ready;
        this._sessionContainer = sessionContainer;
        this._homeserver = homeserver;
        this._loadViewModelSubscription = null;
        this._loadViewModel = null;
        this._loginOptions = loginOptions;
        this.performSSOLoginCompletion();
    }

    get loadViewModel() { return this._loadViewModel; }
    get supportsSSOLogin() { return this._supportsSSOLogin; }
    get isSSOCompletion() { return !!this._loginToken; }

    async performSSOLoginCompletion() {
        if (!this._loginToken) {
            return;
        }
        const homeserver = await this.platform.settingsStorage.getString("homeserver");
        const loginOptions = await this._sessionContainer.queryLogin(homeserver);
        this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
        if (this._loadViewModel) {
            this._loadViewModel = this.disposeTracked(this._loadViewModel);
        }
        this._loadViewModel = this.track(new SessionLoadViewModel(this.childOptions({
            createAndStartSessionContainer: async () => {
                if (loginOptions.sso) {
                    this._sessionContainer.startWithLogin(loginOptions.sso(this._loginToken));
                }
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

    async startSSOLogin() {
        await this.platform.settingsStorage.setString("homeserver", this._homeserver);
        const link = `${this._homeserver}/_matrix/client/r0/login/sso/redirect?redirectUrl=${this.urlCreator.createSSOCallbackURL()}`;
        this.platform.openUrl(link);
    }
}
