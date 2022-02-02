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

import type {HomeServerApi} from "../../net/HomeServerApi";
import type {AccountDetails, RegistrationResponse, AuthenticationData, RegistrationParams} from "../types/types";

export abstract class BaseRegistrationStage {
    protected _hsApi: HomeServerApi;
    protected _accountDetails: AccountDetails;
    protected _session: string;
    protected _nextStage: BaseRegistrationStage;
    protected _params?: Record<string, any>

    constructor(hsApi: HomeServerApi, accountDetails: AccountDetails, session: string, params?: RegistrationParams) {
        this._hsApi = hsApi;
        this._accountDetails = accountDetails;
        this._session = session;
        this._params = params;
    }

    /**
     * eg: m.login.recaptcha or m.login.dummy
     */
    abstract get type(): string;

    /**
     * Finish a registration stage, return value is:
     * - the next stage if this stage was completed successfully
     * - user-id (string) if registration is completed
     */
    abstract complete(auth?: AuthenticationData): Promise<BaseRegistrationStage | string>;

    setNextStage(stage: BaseRegistrationStage) {
        this._nextStage = stage;
    }

    parseResponse(response: RegistrationResponse) {
        if ("user_id" in response) {
            // registration completed successfully
            return response.user_id;
        }
        else if ("completed" in response && response.completed.find(c => c === this.type)) {
            return this._nextStage;
        }
        const error = "error" in response? response.error: "Could not parse response";
        throw new Error(error);
    }
}
