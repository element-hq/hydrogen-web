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

export class CompleteSSOLoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {
            loginToken,
            sessionContainer,
            attemptLogin,
            showError,
        } = options;
        this._loginToken = loginToken;
        this._sessionContainer = sessionContainer;
        this._attemptLogin = attemptLogin;
        this._showError = showError;
        this.performSSOLoginCompletion();
    }

    async performSSOLoginCompletion() {
        if (!this._loginToken) {
            return;
        }
        const homeserver = await this.platform.settingsStorage.getString("sso_ongoing_login_homeserver");
        const loginOptions = await this._sessionContainer.queryLogin(homeserver);
        if (!loginOptions.token) {
            const path = this.navigation.pathFrom([this.navigation.segment("session")]);
            this.navigation.applyPath(path);
            return;
        }
        const status = await this._attemptLogin(loginOptions.token(this._loginToken));
        let error = "";
        switch (status) {
            case LoginFailure.Credentials:
                error = this.i18n`Your logintoken is invalid.`;
                break;
            case LoginFailure.Connection:
                error = this.i18n`Can't connect to ${homeserver}.`;
                break;
            case LoginFailure.Unknown:
                error = this.i18n`Something went wrong while checking your logintoken.`;
                break;
        }
        if (error) {
            this._showError(error);
            this._sessionContainer.resetStatus();
        }
    }
}
