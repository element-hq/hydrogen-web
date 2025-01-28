/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {AuthenticationData, RegistrationParams} from "../types";
import {BaseRegistrationStage} from "./BaseRegistrationStage";

export class TokenAuth extends BaseRegistrationStage {
    private _token?: string;
    private readonly _type: string;

    constructor(session: string, params: RegistrationParams | undefined, type: string) {
        super(session, params);
        this._type = type;
    }


    generateAuthenticationData(): AuthenticationData {
        if (!this._token) {
            throw new Error("No token provided for TokenAuth");
        }
        return {
            session: this._session,
            type: this._type,
            token: this._token,
        };    
    }

    setToken(token: string) {
        this._token = token;
    }

    get type(): string {
        return this._type;
    }
}
