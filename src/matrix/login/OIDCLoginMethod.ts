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

import {ILogItem} from "../../logging/types";
import {ILoginMethod} from "./LoginMethod";
import {HomeServerApi} from "../net/HomeServerApi.js";
import {OidcApi} from "../net/OidcApi";

export class OIDCLoginMethod implements ILoginMethod {
    private readonly _code: string;
    private readonly _codeVerifier: string;
    private readonly _nonce: string;
    private readonly _redirectUri: string;
    private readonly _oidcApi: OidcApi;
    public readonly homeserver: string;

    constructor({
        nonce,
        codeVerifier,
        code,
        homeserver,
        redirectUri,
        oidcApi,
    }: {
        nonce: string,
        code: string,
        codeVerifier: string,
        homeserver: string,
        redirectUri: string,
        oidcApi: OidcApi,
    }) {
        this._oidcApi = oidcApi;
        this._code = code;
        this._codeVerifier = codeVerifier;
        this._nonce = nonce;
        this._redirectUri = redirectUri;
        this.homeserver = homeserver;
    }

    async login(hsApi: HomeServerApi, _deviceName: string, log: ILogItem): Promise<Record<string, any>> {
        const { access_token, refresh_token, expires_in } = await this._oidcApi.completeAuthorizationCodeGrant({
            code: this._code,
            codeVerifier: this._codeVerifier,
            redirectUri: this._redirectUri,
        });

        // TODO: validate the id_token and the nonce claim

        // Do a "whoami" request to find out the user_id and device_id
        const { user_id, device_id } = await hsApi.whoami({
            log,
            accessTokenOverride: access_token,
        }).response();

        const oidc_issuer = this._oidcApi.issuer;

        return { oidc_issuer, access_token, refresh_token, expires_in, user_id, device_id };
    }
}
