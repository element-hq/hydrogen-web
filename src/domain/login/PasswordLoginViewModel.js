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
import {LoginFailure} from "../../matrix/SessionContainer.js";

export class PasswordLoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {ready, loginOptions, sessionContainer, homeserver, attemptLogin, showError} = options;
        this._ready = ready;
        this._sessionContainer = sessionContainer;
        this._loginOptions = loginOptions;
        this._attemptLogin = attemptLogin;
        this._showError = showError;
        this._homeserver = homeserver;
        this._isBusy = false;
    }

    get isBusy() { return this._isBusy; }

    _toggleBusy(state) {
        this._isBusy = state;
        this.emitChange("isBusy");
    }

    async login(username, password) {
        this._toggleBusy(true);
        const status = await this._attemptLogin(this._loginOptions.password(username, password));
        this._toggleBusy(false);
        let error = "";
        switch (status) {
            case LoginFailure.Credentials:
                error = `Your credentials don't seem to be correct.`;
                break;
            case LoginFailure.Connection:
                error = `Can't connect to ${this._homeserver}.`;
                break;
            case LoginFailure.Unknown:
                error = `Something went wrong while checking your credentials.`;
                break;
        }
        if (error) {
            this._showError(error);
            this._sessionContainer.resetStatus();
        }
    }
}
