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

export class StartOIDCLoginViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._isBusy = true;
        this._issuer = options.loginOptions.oidc.issuer;
        this._homeserver = options.loginOptions.homeserver;
        this._api = new OidcApi({
            clientId: "hydrogen-web",
            issuer: this._issuer,
            request: this.platform.request,
            encoding: this.platform.encoding,
            crypto: this.platform.crypto,
        });
    }

    get isBusy() { return this._isBusy; }

    setBusy(status) {
        this._isBusy = status;
        this.emitChange("isBusy");
    }

    async discover() {
        // Ask for the metadata once so it gets discovered and cached
        await this._api.metadata()
    }

    async startOIDCLogin() {
        const p = this._api.generateParams({
            scope: "openid",
            redirectUri: this.urlCreator.createOIDCRedirectURL(),
        });
        await Promise.all([
            this.platform.settingsStorage.setInt(`oidc_${p.state}_started_at`, Date.now()),
            this.platform.settingsStorage.setString(`oidc_${p.state}_nonce`, p.nonce),
            this.platform.settingsStorage.setString(`oidc_${p.state}_code_verifier`, p.codeVerifier),
            this.platform.settingsStorage.setString(`oidc_${p.state}_redirect_uri`, p.redirectUri),
            this.platform.settingsStorage.setString(`oidc_${p.state}_homeserver`, this._homeserver),
            this.platform.settingsStorage.setString(`oidc_${p.state}_issuer`, this._issuer),
        ]);

        const link = await this._api.authorizationEndpoint(p);
        this.platform.openUrl(link);
    }
}
