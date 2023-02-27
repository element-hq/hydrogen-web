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

import type {HomeServerApi} from "../../../net/HomeServerApi";
import type {DeviceTracker} from "../../../e2ee/DeviceTracker.js";
import type {ILogItem} from "../../../../logging/types";
import type {Platform} from "../../../../platform/web/Platform.js";
import type {DeviceMessageHandler} from "../../../DeviceMessageHandler.js";
import {makeTxnId} from "../../../common.js";

const enum ChannelType {
    MessageEvent,
    ToDeviceMessage,
}

const enum VerificationEventTypes {
    Request = "m.key.verification.request",
    Ready = "m.key.verification.ready",
}

export interface IChannel {
    send(eventType: string, content: any, log: ILogItem): Promise<void>;
    waitForEvent(eventType: string): any;
    type: ChannelType;
} 

type Options = {
    hsApi: HomeServerApi;
    deviceTracker: DeviceTracker;
    otherUserId: string;
    platform: Platform;
    deviceMessageHandler: DeviceMessageHandler;
}

export class ToDeviceChannel implements IChannel {
    private readonly hsApi: HomeServerApi;
    private readonly deviceTracker: DeviceTracker;
    private readonly otherUserId: string;
    private readonly platform: Platform;
    private readonly deviceMessageHandler: DeviceMessageHandler;
    private readonly sentMessages: Map<string, any> = new Map();
    private readonly receivedMessages: Map<string, any> = new Map();
    private readonly waitMap: Map<string, {resolve: any, promise: Promise<any>}> = new Map();

    constructor(options: Options) {
        this.hsApi = options.hsApi;
        this.deviceTracker = options.deviceTracker;
        this.otherUserId = options.otherUserId;
        this.platform = options.platform;
        this.deviceMessageHandler = options.deviceMessageHandler;
        // todo: find a way to dispose this subscription
        this.deviceMessageHandler.on("message", ({unencrypted}) => this.handleDeviceMessage(unencrypted))
    }

    get type() {
        return ChannelType.ToDeviceMessage;
    }

    async send(eventType: string, content: any, log: ILogItem): Promise<void> {
        await log.wrap("ToDeviceChannel.send", async () => {
            if (eventType === VerificationEventTypes.Request) {
                // Handle this case specially
                await this.handleRequestEventSpecially(eventType, content, log);
                return;
            }
        });
    }

    async handleRequestEventSpecially(eventType: string, content: any, log: ILogItem) {
        await log.wrap("ToDeviceChannel.handleRequestEventSpecially", async () => {
            const devices = await this.deviceTracker.devicesForUsers([this.otherUserId], this.hsApi, log);
            console.log("devices", devices);
            const timestamp = this.platform.clock.now();
            const txnId = makeTxnId();
            Object.assign(content, { timestamp, transaction_id: txnId });
            const payload = {
                messages: {
                    [this.otherUserId]: {
                        "*": content
                    }
                }
            }
            this.hsApi.sendToDevice(eventType, payload, txnId, { log });
        });
    }

    handleDeviceMessage(event) {
        console.log("event", event);
        this.resolveAnyWaits(event);
        this.receivedMessages.set(event.type, event);
    }

    private resolveAnyWaits(event) {
        const { type } = event;
        const wait = this.waitMap.get(type);
        if (wait) {
            wait.resolve(event);
            this.waitMap.delete(type);
        }
    }

    waitForEvent(eventType: string): Promise<any> {
        const existingWait = this.waitMap.get(eventType);
        if (existingWait) {
            return existingWait.promise;
        }
        let resolve;
        const promise = new Promise(r => {
            resolve = r;
        });
        this.waitMap.set(eventType, { resolve, promise });
        return promise;
    }
} 
