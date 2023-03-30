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
import type {ILogItem} from "../../../../logging/types";
import type {Account} from "../../../e2ee/Account.js";
import type {DeviceTracker} from "../../../e2ee/DeviceTracker.js";
import type {CrossSigning} from "../../CrossSigning";
import {IChannel} from "../channel/Channel";
import {HomeServerApi} from "../../../net/HomeServerApi";
import {SASProgressEvents} from "../types";
import {EventEmitter} from "../../../../utils/EventEmitter";

export type Options = {
    ourUserId: string;
    ourUserDeviceId: string;
    otherUserId: string;
    log: ILogItem;
    olmSas: Olm.SAS;
    olmUtil: Olm.Utility;
    channel: IChannel;
    e2eeAccount: Account;
    deviceTracker: DeviceTracker;
    hsApi: HomeServerApi;
    eventEmitter: EventEmitter<SASProgressEvents>
    crossSigning: CrossSigning
}

export abstract class BaseSASVerificationStage {
    protected ourUserId: string;
    protected ourUserDeviceId: string;
    protected otherUserId: string;
    protected log: ILogItem;
    protected olmSAS: Olm.SAS;
    protected olmUtil: Olm.Utility;
    protected _nextStage: BaseSASVerificationStage;
    protected channel: IChannel;
    protected options: Options;
    protected e2eeAccount: Account;
    protected deviceTracker: DeviceTracker;
    protected hsApi: HomeServerApi;
    protected eventEmitter: EventEmitter<SASProgressEvents>;

    constructor(options: Options) {
        this.options = options;
        this.ourUserId = options.ourUserId;
        this.ourUserDeviceId = options.ourUserDeviceId
        this.otherUserId = options.otherUserId;
        this.log = options.log;
        this.olmSAS = options.olmSas;
        this.olmUtil = options.olmUtil;
        this.channel = options.channel;
        this.e2eeAccount = options.e2eeAccount;
        this.deviceTracker = options.deviceTracker;
        this.hsApi = options.hsApi;
        this.eventEmitter = options.eventEmitter;
    }

    setNextStage(stage: BaseSASVerificationStage) {
        this._nextStage = stage;
    }

    get nextStage(): BaseSASVerificationStage {
        return this._nextStage;
    }

    get otherUserDeviceId(): string {
        const id = this.channel.otherUserDeviceId;
        if (!id) {
            throw new Error("Accessed otherUserDeviceId before it was set in channel!");
        }
        return id;
    }

    abstract completeStage(): Promise<any>;
}
