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
import {CancelTypes, VerificationEventTypes} from "./channel/types";
import {SendReadyStage} from "./stages/SendReadyStage";
import {SelectVerificationMethodStage} from "./stages/SelectVerificationMethodStage";
import {VerificationCancelledError} from "./VerificationCancelledError";
import {Timeout} from "../../../platform/types/types";
import {Platform} from "../../../platform/web/Platform.js";

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
    platform: Platform;
}

export class SASVerification {
    private startStage: BaseSASVerificationStage;
    private olmSas: Olm.SAS;
    public finished: boolean = false;
    public readonly channel: IChannel;
    private readonly timeout: Timeout;
   
    constructor(options: Options) {
        const { olm, channel, platform } = options;
        const olmSas = new olm.SAS();
        this.olmSas = olmSas;
        this.channel = channel;
        this.timeout = platform.clock.createTimeout(10 * 60 * 1000);
        this.timeout.elapsed().then(() => {
            // Cancel verification after 10 minutes
            // todo: catch error here?
            channel.cancelVerification(CancelTypes.TimedOut);
        });
        const stageOptions = {...options, olmSas};
        if (channel.receivedMessages.get(VerificationEventTypes.Start)) {
            this.startStage = new SelectVerificationMethodStage(stageOptions);
        }
        else if (channel.receivedMessages.get(VerificationEventTypes.Request)) {
            this.startStage = new SendReadyStage(stageOptions);
        }
        else {
            this.startStage = new RequestVerificationStage(stageOptions);
        }
        console.log("startStage", this.startStage);
    }

    async start() {
        try {
            let stage = this.startStage;
            do {
                console.log("Running next stage");
                await stage.completeStage();
                stage = stage.nextStage;
            } while (stage);
        }
        catch (e) {
            if (!(e instanceof VerificationCancelledError)) {
                throw e; 
            }
            console.log("Caught error in start()");
        }
        finally {
            this.olmSas.free();
            this.finished = true;
            this.timeout.abort();
        }
    }
}
