/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {ObservableValue} from "../../observable/value/ObservableValue";
import { BaseObservableValue } from "../../observable/value/BaseObservableValue";
import { MappedObservableValue } from "../../observable/value/MappedObservableValue";
import type {Clock, Timeout} from "../../platform/web/dom/Clock";
import {OidcApi} from "./OidcApi";

type Token = {
    accessToken: string,
    accessTokenExpiresAt: number,
    refreshToken: string,
};


export class TokenRefresher {
    private _token: ObservableValue<Token>;
    private _accessToken: BaseObservableValue<string>;
    private _anticipation: number;
    private _clock: Clock;
    private _oidcApi: OidcApi;
    private _timeout: Timeout
    private _running: boolean;

    constructor({
        oidcApi,
        refreshToken,
        accessToken,
        accessTokenExpiresAt,
        anticipation,
        clock,
    }: {
        oidcApi: OidcApi,
        refreshToken: string,
        accessToken: string,
        accessTokenExpiresAt: number,
        anticipation: number,
        clock: Clock,
    }) {
        this._token = new ObservableValue({
            accessToken,
            accessTokenExpiresAt,
            refreshToken,
        });
        this._accessToken = new MappedObservableValue(this._token, (t) => t.accessToken);

        this._anticipation = anticipation;
        this._oidcApi = oidcApi;
        this._clock = clock;
    }

    async start() {
        if (this.needsRenewing) {
            await this.renew();
        }

        this._running = true;
        this._renewingLoop();
    }

    stop() {
        this._running = false;
        if (this._timeout) {
            this._timeout.dispose();
        }
    }

    get needsRenewing() {
        const remaining = this._token.get().accessTokenExpiresAt - this._clock.now();
        const anticipated = remaining - this._anticipation;
        return anticipated < 0;
    }

    async _renewingLoop() {
        while (this._running) {
            const remaining =
                this._token.get().accessTokenExpiresAt - this._clock.now();
            const anticipated = remaining - this._anticipation;

            if (anticipated > 0) {
                this._timeout = this._clock.createTimeout(anticipated);
                try {
                    await this._timeout.elapsed();
                } catch {
                    // The timeout will throw when aborted, so stop the loop if it is the case
                    return;
                }
            }

            await this.renew();
        }
    }

    async renew() {
        let refreshToken = this._token.get().refreshToken;
        const response = await this._oidcApi
            .refreshToken({
                refreshToken,
            });

        if (typeof response.expires_in !== "number") {
            throw new Error("Refreshed access token does not expire");
        }

        if (response.refresh_token) {
            refreshToken = response.refresh_token;
        }

        this._token.set({
            refreshToken,
            accessToken: response.access_token,
            accessTokenExpiresAt: this._clock.now() + response.expires_in * 1000,
        });
    }

    get accessToken(): BaseObservableValue<string> {
        return this._accessToken;
    }

    get token(): BaseObservableValue<Token> {
        return this._token;
    }
}
