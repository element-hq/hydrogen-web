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
        const {loginOptions, homeserver, attemptLogin, showError} = options;
        this._loginOptions = loginOptions;
        this._attemptLogin = attemptLogin;
        this._showError = showError;
        this._homeserver = homeserver;
        this._isBusy = false;
    }

    get isBusy() { return this._isBusy; }

    toggleBusy(state) {
        this._isBusy = state;
        this.emitChange("isBusy");
    }

    async login(username, password) {
        const status = await this._attemptLogin(this._loginOptions.password(username, password));
        let error = "";
        switch (status) {
            case LoginFailure.Credentials:
                error = this.i18n`Your username and/or password don't seem to be correct.`;
                break;
            case LoginFailure.Connection:
                error = this.i18n`Can't connect to ${this._homeserver}.`;
                break;
            case LoginFailure.Unknown:
                error = this.i18n`Something went wrong while checking your login and password.`;
                break;
        }
        if (error) {
            this._showError(error);
        }
    }
}
