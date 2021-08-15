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

export class SSOLoginViewModel extends ViewModel{
    constructor(options) {
        super(options);
        const {
            loginToken,
            sessionContainer,
            loginOptions,
            ready,
            homeserver
        } = options;
        this._loginToken = loginToken;
        this._ready = ready;
        this._sessionContainer = sessionContainer;
        this._homeserver = homeserver;
        this._loadViewModelSubscription = null;
        this._loadViewModel = null;
        this._loginOptions = loginOptions;
    }

    get loadViewModel() { return this._loadViewModel; }
    get supportsSSOLogin() { return this._supportsSSOLogin; }
    get isSSOCompletion() { return !!this._loginToken; }


    async startSSOLogin() {
        console.log("Next PR");
    }
}
