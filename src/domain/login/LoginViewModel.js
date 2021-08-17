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
        this._defaultHomeServer = defaultHomeServer;
        this._loginToken = loginToken;
        this._sessionContainer = this._createSessionContainer();
        this._loginOptions = null;
        this._passwordLoginViewModel = null;
        this._startSSOLoginViewModel = null;
        this._completeSSOLoginViewModel = null;
        this._start();
    }

    get passwordLoginViewModel() { return this._passwordLoginViewModel; }
    get startSSOLoginViewModel() { return this._startSSOLoginViewModel; }
    get completeSSOLoginViewModel(){ return this._completeSSOLoginViewModel; }

    async _start() {
        if (this._loginToken) {
            this._completeSSOLoginViewModel = this.track(new CompleteSSOLoginViewModel(this.childOptions({loginToken: this._loginToken})));
            this.emitChange("completeSSOLoginViewModel");
        }
        else {
            await this.queryLogin(this._defaultHomeServer);
            this._showPasswordLogin();
            this._showSSOLogin(this._defaultHomeServer);
        }
    }

    _showPasswordLogin() {
        this._passwordLoginViewModel = new PasswordLoginViewModel(this.childOptions({defaultHomeServer: this._defaultHomeServer}));
        const observable = this._passwordLoginViewModel.homeserverObservable;
        this.track(observable.subscribe(newHomeServer => this._onHomeServerChange(newHomeServer)));
        this.emitChange("passwordLoginViewModel");
    }

    _showSSOLogin(homeserver) {
        this._startSSOLoginViewModel = this.disposeTracked(this._ssoLoginViewModel);
        this.emitChange("startSSOLoginViewModel");
        if (this._loginOptions?.sso && !this._loginToken) {
            this._startSSOLoginViewModel = this.track(new StartSSOLoginViewModel(this.childOptions({homeserver})));
            this.emitChange("startSSOLoginViewModel");
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
        await this.queryLogin(homeserver);
        this._showSSOLogin(homeserver);
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
