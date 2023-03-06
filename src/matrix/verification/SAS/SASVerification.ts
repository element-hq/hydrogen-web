/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import {RequestVerificationStage} from "./stages/RequestVerificationStage";
import type {ILogItem} from "../../../logging/types";
import type {BaseSASVerificationStage, UserData} from "./stages/BaseSASVerificationStage";
import type {Account} from "../../e2ee/Account.js";
import type {DeviceTracker} from "../../e2ee/DeviceTracker.js";
import type * as OlmNamespace from "@matrix-org/olm";
import {IChannel} from "./channel/Channel";
import {HomeServerApi} from "../../net/HomeServerApi";
import {VerificationEventTypes} from "./channel/types";
import {SendReadyStage} from "./stages/SendReadyStage";
import {SelectVerificationMethodStage} from "./stages/SelectVerificationMethodStage";

type Olm = typeof OlmNamespace;

type Options = {
    olm: Olm;
    olmUtil: Olm.Utility;
    ourUser: UserData;
    otherUserId: string;
    channel: IChannel;
    log: ILogItem;
    e2eeAccount: Account;
    deviceTracker: DeviceTracker;
    hsApi: HomeServerApi;
}

export class SASVerification {
    private startStage: BaseSASVerificationStage;
    private olmSas: Olm.SAS;
   
    constructor(options: Options) {
        const { ourUser, otherUserId, log, olmUtil, olm, channel, e2eeAccount, deviceTracker, hsApi } = options;
        const olmSas = new olm.SAS();
        this.olmSas = olmSas;
        // channel.send("m.key.verification.request", {}, log);
        try {
            const options = { ourUser, otherUserId, log, olmSas, olmUtil, channel, e2eeAccount, deviceTracker, hsApi };
            let stage: BaseSASVerificationStage;
            if (channel.receivedMessages.get(VerificationEventTypes.Start)) {
                stage = new SelectVerificationMethodStage(options);
            }
            else if (channel.receivedMessages.get(VerificationEventTypes.Request)) {
                stage = new SendReadyStage(options);
            }
            else {
                stage = new RequestVerificationStage(options);
            }
            this.startStage = stage;
            console.log("startStage", this.startStage);
        }
        finally {
        }
    }

    async start() {
        try {
            let stage = this.startStage;
            do {
                await stage.completeStage();
                stage = stage.nextStage;
            } while (stage);
        }
        finally {
            this.olmSas.free();
        }
    }
}
