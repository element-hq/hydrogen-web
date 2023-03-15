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

import type {HomeServerApi} from "../net/HomeServerApi";
import type {BaseRegistrationStage} from "./stages/BaseRegistrationStage";
import {DummyAuth} from "./stages/DummyAuth";
import {TermsAuth} from "./stages/TermsAuth";
import {TokenAuth} from "./stages/TokenAuth";
import type {
    AccountDetails,
    RegistrationFlow,
    RegistrationResponseMoreDataNeeded,
    RegistrationResponse,
    RegistrationResponseSuccess,
    AuthData,
    RegistrationParams,
} from "./types";

type FlowSelector = (flows: RegistrationFlow[]) => RegistrationFlow | void;

export class Registration {
    private readonly _hsApi: HomeServerApi;
    private readonly _accountDetails: AccountDetails;
    private readonly _flowSelector: FlowSelector;
    private _registerResponse?: RegistrationResponseSuccess;
    public readonly homeserver: string;

    constructor(homeserver: string, hsApi: HomeServerApi, accountDetails: AccountDetails, flowSelector?: FlowSelector) {
        this.homeserver = homeserver;
        this._hsApi = hsApi;
        this._accountDetails = accountDetails;
        this._flowSelector = flowSelector ?? (flows => flows[0]);
    }

    async start(): Promise<BaseRegistrationStage> {
        const response = await this._hsApi.register(
            this._accountDetails.username,
            this._accountDetails.password,
            this._accountDetails.initialDeviceDisplayName,
            undefined,
            this._accountDetails.inhibitLogin).response();
        return this.parseStagesFromResponse(response);
    }

    /**
     * Finish a registration stage, return value is:
     * - the next stage if this stage was completed successfully
     * - undefined if registration is completed
     */
    async submitStage(stage: BaseRegistrationStage): Promise<BaseRegistrationStage | undefined> {
        const auth = stage.generateAuthenticationData();
        const { username, password, initialDeviceDisplayName, inhibitLogin } = this._accountDetails;
        const request = this._hsApi.register(username, password, initialDeviceDisplayName, auth, inhibitLogin);
        const response = await request.response();
        const status = await request.responseCode();
        const registrationResponse: RegistrationResponse = { ...response, status };
        return this.parseRegistrationResponse(registrationResponse, stage);
    }

    private parseStagesFromResponse(response: RegistrationResponseMoreDataNeeded): BaseRegistrationStage {
        const { session, params } = response;
        const flow = this._flowSelector(response.flows);
        if (!flow) {
            throw new Error("flowSelector did not return any flow!");
        }
        let firstStage: BaseRegistrationStage | undefined;
        let lastStage: BaseRegistrationStage | undefined;
        for (const stage of flow.stages) {
            const registrationStage = this._createRegistrationStage(stage, session, params);
            if (!firstStage) {
                firstStage = registrationStage;
                lastStage = registrationStage;
            } else {
                lastStage!.setNextStage(registrationStage);
                lastStage = registrationStage;
            }
        }
        return firstStage!;
    }

    private async parseRegistrationResponse(response: RegistrationResponse, currentStage: BaseRegistrationStage) {
        switch (response.status) {
            case 200:
                this._registerResponse = response;
                return undefined;
            case 401:
                if (response.completed?.includes(currentStage.type)) {
                    return currentStage.nextStage;
                }
                else {
                    throw new Error("This stage could not be completed!");
                }
        }
    }

    private _createRegistrationStage(type: string, session: string, params?: RegistrationParams) {
        switch (type) {
            case "m.login.dummy":
                return new DummyAuth(session, params?.[type]);
            case "m.login.terms":
                return new TermsAuth(session, params?.[type]);
            case "org.matrix.msc3231.login.registration_token":
            case "m.login.registration_token":
                return new TokenAuth(session, params?.[type], type);
            default:
                throw new Error(`Unknown stage: ${type}`);
        }
    }

    get authData(): AuthData | undefined {
        if (this._registerResponse) {
            return {
                accessToken: this._registerResponse.access_token,
                homeserver: this.homeserver,
                userId: this._registerResponse.user_id,
                deviceId: this._registerResponse.device_id,
            };
        }
    }
}
