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
        this._accountManagementUrl = options.loginOptions.oidc.account;
        this._homeserver = options.loginOptions.homeserver;
        this._api = new OidcApi({
            issuer: this._issuer,
            request: this.platform.request,
            encoding: this.platform.encoding,
            crypto: this.platform.crypto,
            urlCreator: this.urlCreator,
        });
    }

    get isBusy() { return this._isBusy; }

    setBusy(status) {
        this._isBusy = status;
        this.emitChange("isBusy");
    }

    async discover() {
        // Ask for the metadata once so it gets discovered and cached
        try {
            await this._api.metadata()
        } catch (err) {
            this.logger.log("Failed to discover OIDC metadata: " + err);
            throw new Error("Failed to discover OIDC metadata: " + err.message );
        }
        try {
            await this._api.registration();
        } catch (err) {
            this.logger.log("Failed to register OIDC client: " + err);
            throw new Error("Failed to register OIDC client: " + err.message );
        }
    }

    async startOIDCLogin() {
        const deviceScope = this._api.generateDeviceScope();
        const p = this._api.generateParams({
            scope: `openid urn:matrix:api:* ${deviceScope}`,
            redirectUri: this.urlCreator.createOIDCRedirectURL(),
        });
        const clientId = await this._api.clientId();
        await Promise.all([
            this.platform.settingsStorage.setInt(`oidc_${p.state}_started_at`, Date.now()),
            this.platform.settingsStorage.setString(`oidc_${p.state}_nonce`, p.nonce),
            this.platform.settingsStorage.setString(`oidc_${p.state}_code_verifier`, p.codeVerifier),
            this.platform.settingsStorage.setString(`oidc_${p.state}_redirect_uri`, p.redirectUri),
            this.platform.settingsStorage.setString(`oidc_${p.state}_homeserver`, this._homeserver),
            this.platform.settingsStorage.setString(`oidc_${p.state}_issuer`, this._issuer),
            this.platform.settingsStorage.setString(`oidc_${p.state}_client_id`, clientId),
            this.platform.settingsStorage.setString(`oidc_${p.state}_account_management_url`, this._accountManagementUrl),
        ]);

        const link = await this._api.authorizationEndpoint(p);
        this.platform.openUrl(link);
    }
}
