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

import {LoginFailure} from "../../matrix/Client.js";
import type {PasswordLoginMethod} from "../../matrix/login";
import {Options as BaseOptions, ViewModel} from "../ViewModel";
import type {LoginOptions} from "./LoginViewModel";

type Options = {
    loginOptions: LoginOptions | undefined;
    attemptLogin: (loginMethod: PasswordLoginMethod) => Promise<null>;
} & BaseOptions

export class PasswordLoginViewModel extends ViewModel {
    private _loginOptions?: LoginOptions;
    private _attemptLogin: (loginMethod: PasswordLoginMethod) => Promise<null>;
    private _isBusy = false;
    private _errorMessage = "";

    constructor(options: Options) {
        super(options);
        const {loginOptions, attemptLogin} = options;
        this._loginOptions = loginOptions;
        this._attemptLogin = attemptLogin;
    }

    get isBusy(): boolean { return this._isBusy; }
    get errorMessage(): string { return this._errorMessage; }

    setBusy(status: boolean): void {
        this._isBusy = status;
        this.emitChange("isBusy");
    }

    _showError(message: string): void {
        this._errorMessage = message;
        this.emitChange("errorMessage");
    }

    async login(username: string, password: string): Promise<void>{
        this._errorMessage = "";
        this.emitChange("errorMessage");
        const status = await this._attemptLogin(this._loginOptions!.password!(username, password));
        let error = "";
        switch (status) {
            case LoginFailure.Credentials:
                error = this.i18n`Your username and/or password don't seem to be correct.`;
                break;
            case LoginFailure.Connection:
                error = this.i18n`Can't connect to ${this._loginOptions!.homeserver}.`;
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
