import { ObservableValue } from "../../observable/ObservableValue.js";

export class TokenRefresher {
    constructor({
        refreshToken,
        accessToken,
        accessTokenExpiresAt,
        anticipation,
        clock,
    }) {
        this._refreshToken = new ObservableValue(refreshToken);
        this._accessToken = new ObservableValue(accessToken);
        this._accessTokenExpiresAt = new ObservableValue(accessTokenExpiresAt);
        this._anticipation = anticipation;
        this._clock = clock;
    }

    async start(hsApi) {
        this._hsApi = hsApi;
        if (this.needsRenewing) {
            await this.renew();
        }

        this._renewingLoop();
    }

    get needsRenewing() {
        const remaining = this._accessTokenExpiresAt.get() - this._clock.now();
        const anticipated = remaining - this._anticipation;
        return anticipated < 0;
    }

    async _renewingLoop() {
        while (true) {
            const remaining =
                this._accessTokenExpiresAt.get() - this._clock.now();
            const anticipated = remaining - this._anticipation;

            if (anticipated > 0) {
                this._timeout = this._clock.createTimeout(anticipated);
                await this._timeout.elapsed();
            }

            await this.renew();
        }
    }

    async renew() {
        const response = await this._hsApi
            .refreshToken(this._refreshToken.get())
            .response();

        if (response["refresh_token"]) {
            this._refreshToken.set(response["refresh_token"]);
        }

        this._accessToken.set(response["access_token"]);
        this._accessTokenExpiresAt.set(
            this._clock.now() + response["expires_in"] * 1000
        );
    }

    get accessToken() {
        return this._accessToken;
    }

    get refreshToken() {
        return this._refreshToken;
    }
}
