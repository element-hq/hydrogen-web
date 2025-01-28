/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Options as BaseOptions, ViewModel} from "../ViewModel";
import {LoginFailure} from "../../matrix/Client.js";
import type {TokenLoginMethod} from "../../matrix/login";
import { Client } from "../../matrix/Client.js";

type Options = {
    client: Client;
    attemptLogin: (loginMethod: TokenLoginMethod) => Promise<null>;
    loginToken: string;
} & BaseOptions

export class CompleteSSOLoginViewModel extends ViewModel {
    private _loginToken: string;
    private _client: Client;
    private _attemptLogin: (loginMethod: TokenLoginMethod) => Promise<null>;
    private _errorMessage = "";

    constructor(options: Options) {
        super(options);
        const {
            loginToken,
            client,
            attemptLogin,
        } = options;
        this._loginToken = loginToken;
        this._client = client;
        this._attemptLogin = attemptLogin;
        this._errorMessage = "";
        void this.performSSOLoginCompletion();
    }

    get errorMessage(): string { return this._errorMessage; }

    _showError(message: string): void {
        this._errorMessage = message;
        this.emitChange("errorMessage");
    }

    async performSSOLoginCompletion(): Promise<void> {
        if (!this._loginToken) {
            return;
        }
        const homeserver = await this.platform.settingsStorage.getString("sso_ongoing_login_homeserver");
        let loginOptions: { token?: (loginToken: string) => TokenLoginMethod; };
        try {
            loginOptions = await this._client.queryLogin(homeserver).result;
        }
        catch (err) {
            this._showError(err.message);
            return;
        }
        if (!loginOptions.token) {
            this.navigation.push("session");
            return;
        }
        const status = await this._attemptLogin(loginOptions.token(this._loginToken));
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
