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

import type {RequestFunction} from "../../platform/types/types";
import type {IURLRouter} from "../../domain/navigation/URLRouter.js";
import type {SegmentType} from "../../domain/navigation";

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
    redirectUri: string,
    nonce?: string,
    codeVerifier?: string,
};

function assert(condition: any, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
};

type IssuerUri = string;
interface ClientConfig {
    client_id: string;
    client_secret?: string;
}

// These are statically configured OIDC client IDs for particular issuers:
const clientIds: Record<IssuerUri, ClientConfig> = {
    "https://id.thirdroom.io/realms/thirdroom/": {
        client_id: "thirdroom"
    },
};

export class OidcApi<N extends object = SegmentType> {
    _issuer: string;
    _requestFn: RequestFunction;
    _encoding: any;
    _crypto: any;
    _urlCreator: IURLRouter<N>;
    _metadataPromise: Promise<any>;
    _registrationPromise: Promise<any>;

    constructor({ issuer, request, encoding, crypto, urlCreator, clientId }) {
        this._issuer = issuer;
        this._requestFn = request;
        this._encoding = encoding;
        this._crypto = crypto;
        this._urlCreator = urlCreator;

        if (clientId) {
            this._registrationPromise = Promise.resolve({ client_id: clientId });
        }
    }

    get clientMetadata() {
        return {
            client_name: "Hydrogen Web",
            logo_uri: this._urlCreator.absoluteUrlForAsset("icon.png"),
            client_uri: this._urlCreator.absoluteAppUrl(),
            tos_uri: "https://element.io/terms-of-service",
            policy_uri: "https://element.io/privacy",
            response_types: ["code"],
            grant_types: ["authorization_code", "refresh_token"],
            redirect_uris: [this._urlCreator.createOIDCRedirectURL()],
            id_token_signed_response_alg: "RS256",
            token_endpoint_auth_method: "none",
        };
    }

    get metadataUrl() {
        return new URL(WELL_KNOWN, `${this._issuer}${this._issuer.endsWith('/') ? '' : '/'}`).toString();
    }

    get issuer() {
        return this._issuer;
    }

    async clientId(): Promise<string> {
        return (await this.registration())["client_id"];
    }

    registration(): Promise<any> {
        if (!this._registrationPromise) {
            this._registrationPromise = (async () => {
                // use static client if available
                const authority = `${this.issuer}${this.issuer.endsWith('/') ? '' : '/'}`;

                if (clientIds[authority]) {
                    return clientIds[authority];
                }

                const headers = new Map();
                headers.set("Accept", "application/json");
                headers.set("Content-Type", "application/json");
                const req = this._requestFn(await this.registrationEndpoint(), {
                    method: "POST",
                    headers,
                    format: "json",
                    body: JSON.stringify(this.clientMetadata),
                });
                const res = await req.response();
                if (res.status >= 400) {
                    throw new Error("failed to register client");
                }

                return res.body;
            })();
        }

        return this._registrationPromise;
    }

    metadata(): Promise<any> {
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
        assert(typeof m.registration_endpoint === "string", "Has a registration endpoint");
        assert(Array.isArray(m.response_types_supported) && m.response_types_supported.includes("code"), "Supports the code response type");
        assert(Array.isArray(m.response_modes_supported) && m.response_modes_supported.includes("fragment"), "Supports the fragment response mode");
        assert(typeof m.authorization_endpoint === "string" || (Array.isArray(m.grant_types_supported) && m.grant_types_supported.includes("authorization_code")), "Supports the authorization_code grant type");
        assert(Array.isArray(m.code_challenge_methods_supported) && m.code_challenge_methods_supported.includes("S256"), "Supports the authorization_code grant type");
    }

    async _generateCodeChallenge(
        codeVerifier: string
    ): Promise<string> {
        const data = this._encoding.utf8.encode(codeVerifier);
        const digest = await this._crypto.digest("SHA-256", data);
        const base64Digest = this._encoding.base64.encode(digest);
        return base64Digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }

    async authorizationEndpoint({
        state,
        redirectUri,
        scope,
        nonce,
        codeVerifier,
    }: AuthorizationParams): Promise<string> {
        const metadata = await this.metadata();
        const url = new URL(metadata["authorization_endpoint"]);
        url.searchParams.append("response_mode", "fragment");
        url.searchParams.append("response_type", "code");
        url.searchParams.append("redirect_uri", redirectUri);
        url.searchParams.append("client_id", await this.clientId());
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

    async tokenEndpoint(): Promise<string> {
        const metadata = await this.metadata();
        return metadata["token_endpoint"];
    }

    async registrationEndpoint(): Promise<string> {
        const metadata = await this.metadata();
        return metadata["registration_endpoint"];
    }

    async revocationEndpoint(): Promise<string | undefined> {
        const metadata = await this.metadata();
        return metadata["revocation_endpoint"];
    }

    generateDeviceScope(): String {
        const deviceId = randomString(10);
        return `urn:matrix:org.matrix.msc2967.client:device:${deviceId}`;
    }

    generateParams({ scope, redirectUri }: { scope: string, redirectUri: string }): AuthorizationParams {
        return {
            scope,
            redirectUri,
            state: randomString(8),
            nonce: randomString(8),
            codeVerifier: randomString(64), // https://tools.ietf.org/html/rfc7636#section-4.1 length needs to be 43-128 characters
        };
    }

    async completeAuthorizationCodeGrant({
        codeVerifier,
        code,
        redirectUri,
    }: { codeVerifier: string, code: string, redirectUri: string }): Promise<BearerToken> {
        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("client_id", await this.clientId());
        params.append("code_verifier", codeVerifier);
        params.append("redirect_uri", redirectUri);
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
        params.append("client_id", await this.clientId());
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

    async revokeToken({
        token,
        type,
    }: { token: string, type: "refresh" | "access" }): Promise<void> {
        const revocationEndpoint = await this.revocationEndpoint();
        if (!revocationEndpoint) {
            return;
        }

        const params = new URLSearchParams();
        params.append("token_type", type);
        params.append("token", token);
        params.append("client_id", await this.clientId());
        const body = params.toString();

        const headers = new Map();
        headers.set("Content-Type", "application/x-www-form-urlencoded");

        const req = this._requestFn(revocationEndpoint, {
            method: "POST",
            headers,
            format: "json",
            body,
        });

        const res = await req.response();
        if (res.status >= 400) {
            throw new Error("failed to revoke token");
        }
    }
}
