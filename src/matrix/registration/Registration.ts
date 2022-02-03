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
import {registrationStageFromType} from "./registrationStageFromType";
import type {BaseRegistrationStage} from "./stages/BaseRegistrationStage";
import type {AccountDetails, RegistrationFlow, RegistrationResponseMoreDataNeeded} from "./types/types";

type FlowSelector = (flows: RegistrationFlow[]) => RegistrationFlow | void;

export class Registration {
    private _hsApi: HomeServerApi;
    private _accountDetails: AccountDetails;
    private _flowSelector: FlowSelector;

    constructor(hsApi: HomeServerApi, accountDetails: AccountDetails, flowSelector?: FlowSelector) {
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

    parseStagesFromResponse(response: RegistrationResponseMoreDataNeeded): BaseRegistrationStage {
        const { session, params } = response;
        const flow = this._flowSelector(response.flows);
        if (!flow) {
            throw new Error("flowSelector did not return any flow!");
        }
        let firstStage: BaseRegistrationStage | undefined;
        let lastStage: BaseRegistrationStage;
        for (const stage of flow.stages) {
            const stageClass = registrationStageFromType(stage);
            if (!stageClass) {
                throw new Error(`Unknown stage: ${stage}`);
            }
            const registrationStage = new stageClass(this._hsApi, this._accountDetails, session, params?.[stage]);
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
}
