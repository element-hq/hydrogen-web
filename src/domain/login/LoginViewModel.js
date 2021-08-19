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
import {StartSSOLoginViewModel} from "./StartSSOLoginViewModel.js";
import {CompleteSSOLoginViewModel} from "./CompleteSSOLoginViewModel.js";

export class LoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {ready, defaultHomeServer, createSessionContainer, loginToken} = options;
        this._createSessionContainer = createSessionContainer;
        this._ready = ready;
        this._loginToken = loginToken;
        this._sessionContainer = this._createSessionContainer();
        this._loginOptions = null;
        this._passwordLoginViewModel = null;
        this._startSSOLoginViewModel = null;
        this._completeSSOLoginViewModel = null;
        this._homeserver = defaultHomeServer;
        this._errorMessage = "";
        this._start(this._homeserver);
    }

    get passwordLoginViewModel() { return this._passwordLoginViewModel; }
    get startSSOLoginViewModel() { return this._startSSOLoginViewModel; }
    get completeSSOLoginViewModel(){ return this._completeSSOLoginViewModel; }
    get defaultHomeServer() { return this._homeserver; }
    get errorMessage() { return this._errorMessage; }

    async _start(homeserver) {
        if (this._loginToken) {
            this._completeSSOLoginViewModel = this.track(new CompleteSSOLoginViewModel(this.childOptions({loginToken: this._loginToken})));
            this.emitChange("completeSSOLoginViewModel");
        }
        else {
            this._errorMessage = "";
            await this.queryLogin(homeserver);
            if (this._loginOptions) {
                if (this._loginOptions.sso) { this._showSSOLogin(); }
                if (this._loginOptions.password) { this._showPasswordLogin(); }
                if (!this._loginOptions.sso && !this._loginOptions.password) {
                    this._showError("This homeserver neither supports SSO nor Password based login flows");
                } 
            }
            else {
                this._showError("Could not query login methods supported by the homeserver");
            }
        }
    }

    _showPasswordLogin() {
        this._passwordLoginViewModel = this.track(new PasswordLoginViewModel(this.childOptions()));
        this.emitChange("passwordLoginViewModel");
    }

    _showSSOLogin() {
        this._startSSOLoginViewModel = this.track(new StartSSOLoginViewModel(this.childOptions()));
        this.emitChange("startSSOLoginViewModel");
    }

    _showError(message) {
        this._errorMessage = message;
        this.emitChange("errorMessage");
    }

    async queryLogin(homeserver) {
        try {
            this._loginOptions = await this._sessionContainer.queryLogin(homeserver);
        }
        catch (e) {
            this._loginOptions = null;
        }
    }

    _disposeViewModels() {
        this._startSSOLoginViewModel = this.disposeTracked(this._ssoLoginViewModel);
        this._passwordLoginViewModel = this.disposeTracked(this._passwordLoginViewModel);
        this.emitChange("disposeViewModels");
    }

    updateHomeServer(newHomeserver) {
        this._homeserver = newHomeserver;
        this._disposeViewModels();
        this._start(newHomeserver);
    }

    childOptions(options = {}) {
        return {
            ...super.childOptions(options),
            ready: sessionContainer => {
                // make sure we don't delete the session in dispose when navigating away
                this._sessionContainer = null;
                this._ready(sessionContainer);
            },
            sessionContainer: this._sessionContainer,
            loginOptions: this._loginOptions,
            homeserver: this._homeserver
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
