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
import { registrationStageFromType } from "./registrationStageFromType";
import type {BaseRegistrationStage} from "./stages/BaseRegistrationStage";

export type RegistrationParameters = {
    username: string;
    password: string;
    initialDeviceDisplayName: string;
    inhibitLogin: boolean;
}

// todo: type this later
export type RegistrationResponse = {
    [key: string]: any;
}

export class Registration {
    private _hsApi: HomeServerApi;
    private _data: RegistrationParameters;
    private _firstStage: BaseRegistrationStage;
    private _session: string;

    constructor(hsApi: HomeServerApi, data: RegistrationParameters) {
        this._hsApi = hsApi;
        this._data = data;
    }

    private async _fetchFlows(): Promise<RegistrationResponse> {
        const response = await this._hsApi.register(
            this._username,
            this._password,
            this._initialDeviceDisplayName,
            undefined,
            this._inhibitLogin).response();
        return response; 
    }

    async start(): Promise<BaseRegistrationStage> {
        const response = await this._fetchFlows();
        this.parseStagesFromResponse(response);
        await new Promise(r => setTimeout(r, 2000));
        return this._firstStage;
    }

    parseStagesFromResponse(response: RegistrationResponse) {
        this._session = response.session;
        const flow = response.flows.pop();
        let lastStage: BaseRegistrationStage;
        for (const stage of flow.stages) {
            const stageClass = registrationStageFromType(stage);
            if (!stageClass) {
                throw new Error("Unknown stage");
            }
            const registrationStage = new stageClass(this._hsApi, this._data, this._session);
            if (!this._firstStage) {
                this._firstStage = registrationStage;
                lastStage = registrationStage;
            } else {
                lastStage!.setNextStage(registrationStage);
                lastStage = registrationStage;
            }
        }
    }

    private get _username() { return this._data.username; }
    private get _password() { return this._data.password; }
    private get _initialDeviceDisplayName() { return this._data.initialDeviceDisplayName; }
    private get _inhibitLogin() { return this._data.inhibitLogin; }
}
