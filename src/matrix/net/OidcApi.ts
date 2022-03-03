/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const WELL_KNOWN = ".well-known/openid-configuration";

const RANDOM_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randomChar = () => RANDOM_CHARSET.charAt(Math.floor(Math.random() * 1e10) % RANDOM_CHARSET.length);
const randomString = (length: number) =>
    Array.from({ length }, randomChar).join("");

type BearerToken = {
    token_type: "Bearer",
    access_token: string,
    refresh_token?: string,
    expires_in?: number,
}

const isValidBearerToken = (t: any): t is BearerToken =>
    typeof t == "object" &&
    t["token_type"] === "Bearer" &&
    typeof t["access_token"] === "string" &&
    (!("refresh_token" in t) || typeof t["refresh_token"] === "string") &&
    (!("expires_in" in t) || typeof t["expires_in"] === "number");


type AuthorizationParams = {
    state: string,
    scope: string,
    nonce?: string,
    codeVerifier?: string,
};

function assert(condition: any, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
};

export class OidcApi {
    _issuer: string;
    _clientId: string;
    _requestFn: any;
    _base64: any;
    _metadataPromise: Promise<any>;

    constructor({ issuer, clientId, request, encoding }) {
        this._issuer = issuer;
        this._clientId = clientId;
        this._requestFn = request;
        this._base64 = encoding.base64;
    }

    get metadataUrl() {
        return new URL(WELL_KNOWN, this._issuer).toString();
    }

    get issuer() {
        return this._issuer;
    }

    get redirectUri() {
        return window.location.origin;
    }

    metadata() {
        if (!this._metadataPromise) {
            this._metadataPromise = (async () => {
                const headers = new Map();
                headers.set("Accept", "application/json");
                const req = this._requestFn(this.metadataUrl, {
                    method: "GET",
                    headers,
                    format: "json",
                });
                const res = await req.response();
                if (res.status >= 400) {
                    throw new Error("failed to request metadata");
                }

                return res.body;
            })();
        }
        return this._metadataPromise;
    }

    async validate() {
        const m = await this.metadata();
        assert(typeof m.authorization_endpoint === "string", "Has an authorization endpoint");
        assert(typeof m.token_endpoint === "string", "Has a token endpoint");
        assert(Array.isArray(m.response_types_supported) && m.response_types_supported.includes("code"), "Supports the code response type");
        assert(Array.isArray(m.response_modes_supported) && m.response_modes_supported.includes("fragment"), "Supports the fragment response mode");
        assert(Array.isArray(m.grant_types_supported) && m.grant_types_supported.includes("authorization_code"), "Supports the authorization_code grant type");
        assert(Array.isArray(m.code_challenge_methods_supported) && m.code_challenge_methods_supported.includes("S256"), "Supports the authorization_code grant type");
    }

    async _generateCodeChallenge(
        codeVerifier: string
    ): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await window.crypto.subtle.digest("SHA-256", data);
        const base64Digest = this._base64.encode(digest);
        return base64Digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }

    async authorizationEndpoint({
        state,
        scope,
        nonce,
        codeVerifier,
    }: AuthorizationParams) {
        const metadata = await this.metadata();
        const url = new URL(metadata["authorization_endpoint"]);
        url.searchParams.append("response_mode", "fragment");
        url.searchParams.append("response_type", "code");
        url.searchParams.append("redirect_uri", this.redirectUri);
        url.searchParams.append("client_id", this._clientId);
        url.searchParams.append("state", state);
        url.searchParams.append("scope", scope);
        if (nonce) {
            url.searchParams.append("nonce", nonce);
        }

        if (codeVerifier) {
            url.searchParams.append("code_challenge_method", "S256");
            url.searchParams.append("code_challenge", await this._generateCodeChallenge(codeVerifier));
        }

        return url.toString();
    }

    async tokenEndpoint() {
        const metadata = await this.metadata();
        return metadata["token_endpoint"];
    }

    generateParams(scope: string): AuthorizationParams {
        return {
            scope,
            state: randomString(8),
            nonce: randomString(8),
            codeVerifier: randomString(32),
        };
    }

    async completeAuthorizationCodeGrant({
        codeVerifier,
        code,
    }: { codeVerifier: string, code: string }): Promise<BearerToken> {
        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("client_id", this._clientId);
        params.append("code_verifier", codeVerifier);
        params.append("redirect_uri", this.redirectUri);
        params.append("code", code);
        const body = params.toString();

        const headers = new Map();
        headers.set("Content-Type", "application/x-www-form-urlencoded");

        const req = this._requestFn(await this.tokenEndpoint(), {
            method: "POST",
            headers,
            format: "json",
            body,
        });

        const res = await req.response();
        if (res.status >= 400) {
            throw new Error("failed to exchange authorization code");
        }

        const token = res.body;
        assert(isValidBearerToken(token), "Got back a valid bearer token");

        return token;
    }

    async refreshToken({
        refreshToken,
    }: { refreshToken: string }): Promise<BearerToken> {
        const params = new URLSearchParams();
        params.append("grant_type", "refresh_token");
        params.append("client_id", this._clientId);
        params.append("refresh_token", refreshToken);
        const body = params.toString();

        const headers = new Map();
        headers.set("Content-Type", "application/x-www-form-urlencoded");

        const req = this._requestFn(await this.tokenEndpoint(), {
            method: "POST",
            headers,
            format: "json",
            body,
        });

        const res = await req.response();
        if (res.status >= 400) {
            throw new Error("failed to use refresh token");
        }

        const token = res.body;
        assert(isValidBearerToken(token), "Got back a valid bearer token");

        return token;
    }
}
