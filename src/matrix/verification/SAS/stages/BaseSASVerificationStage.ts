/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {ILogItem} from "../../../../logging/types";
import type {Account} from "../../../e2ee/Account.js";
import type {DeviceTracker} from "../../../e2ee/DeviceTracker.js";
import {IChannel} from "../channel/IChannel";
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
