/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class SSOLoginHelper{
    private _homeserver: string;

    constructor(homeserver: string) {
        this._homeserver = homeserver;
    }

    get homeserver(): string { return this._homeserver; }

    createSSORedirectURL(returnURL: string): string {
        return `${this._homeserver}/_matrix/client/r0/login/sso/redirect?redirectUrl=${encodeURIComponent(returnURL)}`;
    }
}
