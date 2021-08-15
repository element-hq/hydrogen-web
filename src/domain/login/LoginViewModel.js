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

import {ViewModel} from "../ViewModel.js";
import {PasswordLoginViewModel} from "./PasswordLoginViewModel.js";
import {SSOLoginViewModel} from "./SSOLoginViewModel.js";
import {normalizeHomeserver} from "./common.js";

export class LoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {ready, defaultHomeServer, createSessionContainer, loginToken} = options;
        this._createSessionContainer = createSessionContainer;
        this._ready = ready;
        this._defaultHomeServer = defaultHomeServer;
        this._loginToken = loginToken;
        this._sessionContainer = this._createSessionContainer();
        this._loginOptions = null;
        this._start();
    }

    get passwordLoginViewModel() { return this._passwordLoginViewModel; }
    get ssoLoginViewModel() { return this._ssoLoginViewModel; }
    get loadViewModel() {return this._loadViewModel; }

    async _start() {
        if (this._loginToken) {
            this._ssoLoginViewModel = this.track(new SSOLoginViewModel(this.childOptions({loginToken: this._loginToken})));
            this.emitChange("ssoLoginViewModel");
        }
        else {
            const defaultHomeServer = normalizeHomeserver(this._defaultHomeServer);
            await this.queryLogin(defaultHomeServer);
            this._showPasswordLogin();
            this._showSSOLogin(defaultHomeServer);
        }
    }

    _showPasswordLogin() {
        this._passwordLoginViewModel = new PasswordLoginViewModel(this.childOptions({defaultHomeServer: this._defaultHomeServer}));
        const observable = this._passwordLoginViewModel.homeserverObservable;
        this.track(observable.subscribe(newHomeServer => this._onHomeServerChange(newHomeServer)));
        this.emitChange("passwordLoginViewModel");
    }

    _showSSOLogin(homeserver) {
        this._ssoLoginViewModel = this.disposeTracked(this._ssoLoginViewModel);
        this.emitChange("ssoLoginViewModel");
        if (this._loginOptions?.sso && !this._loginToken) {
            this._ssoLoginViewModel = this.track(new SSOLoginViewModel(this.childOptions({homeserver})));
            this.emitChange("ssoLoginViewModel");
        }
    }

    async queryLogin(homeserver) {
        try {
            this._loginOptions = await this._sessionContainer.queryLogin(homeserver);
        }
        catch (e) {
            this._loginOptions = null;
            console.error("Could not query login methods supported by the homeserver");
        }
    }

    async _onHomeServerChange(homeserver) {
        const normalizedHS = normalizeHomeserver(homeserver);
        await this.queryLogin(normalizedHS);
        this._showSSOLogin(normalizedHS);
    }

    childOptions(options) {
        return {
            ...super.childOptions(options),
            ready: sessionContainer => {
                // make sure we don't delete the session in dispose when navigating away
                this._sessionContainer = null;
                this._ready(sessionContainer);
            },
            sessionContainer: this._sessionContainer,
            loginOptions: this._loginOptions
        }
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
