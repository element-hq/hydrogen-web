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

import {OidcApi} from "../../matrix/net/OidcApi";
import {ViewModel} from "../ViewModel";
import {OIDCLoginMethod} from "../../matrix/login/OIDCLoginMethod";
import {LoginFailure} from "../../matrix/Client";

export class CompleteOIDCLoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {
            state,
            code,
            attemptLogin,
        } = options;
        this._request = options.platform.request;
        this._encoding = options.platform.encoding;
        this._crypto = options.platform.crypto;
        this._state = state;
        this._code = code;
        this._attemptLogin = attemptLogin;
        this._errorMessage = "";
        this.performOIDCLoginCompletion();
    }

    get errorMessage() { return this._errorMessage; }

    _showError(message) {
        this._errorMessage = message;
        this.emitChange("errorMessage");
    }

    async performOIDCLoginCompletion() {
        if (!this._state || !this._code) {
            return;
        }
        const code = this._code;
        // TODO: cleanup settings storage
        const [startedAt, nonce, codeVerifier, redirectUri, homeserver, issuer, clientId, accountManagementUrl] = await Promise.all([
            this.platform.settingsStorage.getInt(`oidc_${this._state}_started_at`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_nonce`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_code_verifier`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_redirect_uri`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_homeserver`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_issuer`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_client_id`),
            this.platform.settingsStorage.getString(`oidc_${this._state}_account_management_url`),
        ]);

        const oidcApi = new OidcApi({
            issuer,
            clientId,
            request: this._request,
            encoding: this._encoding,
            crypto: this._crypto,
        });
        const method = new OIDCLoginMethod({oidcApi, nonce, codeVerifier, code, homeserver, startedAt, redirectUri, accountManagementUrl});
        const status = await this._attemptLogin(method);
        let error = "";
        switch (status) {
            case LoginFailure.Credentials:
                error = this.i18n`Your login token is invalid.`;
                break;
            case LoginFailure.Connection:
                error = this.i18n`Can't connect to ${homeserver}.`;
                break;
            case LoginFailure.Unknown:
                error = this.i18n`Something went wrong while checking your login token.`;
                break;
        }
        if (error) {
            this._showError(error);
        }
    }
}
