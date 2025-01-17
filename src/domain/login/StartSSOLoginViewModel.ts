/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {SSOLoginHelper} from "../../matrix/login";
import {Options as BaseOptions, ViewModel} from "../ViewModel";
import type {LoginOptions} from "./LoginViewModel";


type Options = {
    loginOptions: LoginOptions | undefined;
} & BaseOptions;

export class StartSSOLoginViewModel extends ViewModel{
    private _sso?: SSOLoginHelper;
    private _isBusy = false;

    constructor(options: Options) {
        super(options);
        this._sso = options.loginOptions!.sso;
        this._isBusy = false;
    }

    get isBusy(): boolean { return this._isBusy; }

    setBusy(status: boolean): void {
        this._isBusy = status;
        this.emitChange("isBusy");
    }

    async startSSOLogin(): Promise<void> {
        await this.platform.settingsStorage.setString("sso_ongoing_login_homeserver", this._sso!.homeserver);
        const link = this._sso!.createSSORedirectURL(this.urlRouter.createSSOCallbackURL());
        this.platform.openUrl(link);
    }
}
