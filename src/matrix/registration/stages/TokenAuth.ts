/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {AuthenticationData} from "../types";
import {BaseRegistrationStage} from "./BaseRegistrationStage";

export const TOKEN_AUTH_TYPE = "org.matrix.msc3231.login.registration_token";

export class TokenAuth extends BaseRegistrationStage {
    private _token?: string;

    generateAuthenticationData(): AuthenticationData {
        if (!this._token) {
            throw new Error("No token provided for TokenAuth");
        }
        return {
            session: this._session,
            type: this.type,
            token: this._token,
        };    
    }

    setToken(token: string) {
        this._token = token;
    }

    get type(): string {
        return TOKEN_AUTH_TYPE;
    }
}
