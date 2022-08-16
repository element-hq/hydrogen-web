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

import {ViewModel} from "../ViewModel";
import {LoginFailure} from "../../matrix/Client.js";

export class PasswordLoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {loginOptions, attemptLogin} = options;
        this._loginOptions = loginOptions;
        this._attemptLogin = attemptLogin;
        this._isBusy = false;
        this._enabled = true;
        this._errorMessage = "";
    }

    get isBusy() { return this._isBusy; }
    get isEnabled() { return this._isEnabled; }
    get errorMessage() { return this._errorMessage; }

    setBusy(status) {
        this._isBusy = status;
        this.emitChange("isBusy");
    }

    _showError(message) {
        this._errorMessage = message;
        this.emitChange("errorMessage");
    }
    
    setLoginOptions(loginOptions) {
        this._loginOptions = loginOptions;
    }
    
    setEnabled(enabled) {
        this._enabled = enabled;
        this.emitChange("isEnabled");
    }
    
    findHomeserverFromUserid (userid) {
        const matches = userid.match(/@.*:(.+)/);
        if (!matches) {
            return;
        }
        const [, homeserverInMxid] = matches;
        return homeserverInMxid;
    }

    findUsernameFromUsertext (userid) {
        const matches = userid.match(/@(.+):.*/);
        if (!matches) {
            return userid;
        }
        const [, username] = matches;
        return username;
    }
    
    async changeHomeserverFromUserid(userid) {
        const currentHomeserver = this._loginOptions.homeserver;
        const newHomeserver = this.findHomeserverFromUserid(userid);
        if (this._loginOptions.homeserver != newHomeserver && newHomeserver) {
            await this._options.setHomeserver(newHomeserver);
            return true;
        }
        return false;
    }

    async parseUsernameLogin (username) {
        await this.changeHomeserverFromUserid(username);
        return this.findUsernameFromUsertext(username);
    }
    
    async login(username, password) {
        this.setBusy(true);
        username = await this.parseUsernameLogin(username);
        if (!this._loginOptions) {
            return;
        }
        this._showError("");
        const status = await this._attemptLogin(this._loginOptions.password(username, password));
        let error = "";
        switch (status) {
            case LoginFailure.Credentials:
                error = this.i18n`Your username and/or password don't seem to be correct.`;
                break;
            case LoginFailure.Connection:
                error = this.i18n`Can't connect to ${this._loginOptions.homeserver}.`;
                break;
            case LoginFailure.Unknown:
                error = this.i18n`Something went wrong while checking your login and password.`;
                break;
        }
        if (error) {
            console.log(error);
            this._showError(error);
        }
        this.setBusy(false);
    }
}
