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

export type Auth = {
    [key: string]: any;
}

import type {HomeServerApi} from "../../net/HomeServerApi";
import type {RegistrationParameters, RegistrationResponse} from "../Registration";

export abstract class BaseRegistrationStage {
    protected _hsApi: HomeServerApi;
    protected _registrationData: RegistrationParameters;
    protected _session: string;
    protected _nextStage: BaseRegistrationStage;

    constructor(hsApi: HomeServerApi, registrationData: RegistrationParameters, session: string) {
        this._hsApi = hsApi;
        this._registrationData = registrationData;
        this._session = session;
    }

    /**
     * eg: m.login.recaptcha or m.login.dummy
     */
    abstract get type(): string;

    /**
     * Finish a registration stage, return value is:
     * - the next stage if this stage was completed successfully
     * - true if registration is completed
     * - an error if something went wrong
     */
    abstract complete(auth?: Auth): Promise<BaseRegistrationStage | Error | true>;

    setNextStage(stage: BaseRegistrationStage) {
        this._nextStage = stage;
    }

    parseResponse(response: RegistrationResponse) {
        if (response.user_id) {
            // registration completed successfully
            return true;
        }
        else if (response.completed?.find(c => c === this.type)) {
            return this._nextStage;
        }
        const error = response.error ?? "Could not parse response";
        return new Error(error);
        }
}
