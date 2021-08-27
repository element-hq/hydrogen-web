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

export class StartSSOLoginViewModel extends ViewModel{
    constructor(options) {
        super(options);
        this._sso = options.loginOptions.sso;
        this._isBusy = false;
    }
   
    get isBusy() { return this._isBusy; }
    
    setBusy(status) {
        this._isBusy = status;
        this.emitChange("isBusy");
    }

    async startSSOLogin() {
        await this.platform.settingsStorage.setString("sso_ongoing_login_homeserver", this._sso.homeserver);
        const link = this._sso.createSSORedirectURL(this.urlCreator.createSSOCallbackURL());
        this.platform.openUrl(link);
    }
}
