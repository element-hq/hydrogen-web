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
import {CancelTypes, VerificationEventTypes} from "./types";

const messageFromErrorType = {
    [CancelTypes.UserCancelled]: "User cancelled this request.",
    [CancelTypes.InvalidMessage]: "Invalid Message.",
    [CancelTypes.KeyMismatch]: "Key Mismatch.",
    [CancelTypes.OtherUserAccepted]: "Another device has accepted this request.",
    [CancelTypes.TimedOut]: "Timed Out",
    [CancelTypes.UnexpectedMessage]: "Unexpected Message.",
    [CancelTypes.UnknownMethod]: "Unknown method.",
    [CancelTypes.UnknownTransaction]: "Unknown Transaction.",
    [CancelTypes.UserMismatch]: "User Mismatch",
    [CancelTypes.MismatchedCommitment]: "Hash commitment does not match.",
    [CancelTypes.MismatchedSAS]: "Emoji/decimal does not match.",
}

const enum ChannelType {
    MessageEvent,
    ToDeviceMessage,
}

export interface IChannel {
    send(eventType: string, content: any, log: ILogItem): Promise<void>;
    waitForEvent(eventType: string): Promise<any>;
    type: ChannelType;
    id: string;
    otherUserDeviceId: string;
    sentMessages: Map<string, any>;
    receivedMessages: Map<string, any>;
    localMessages: Map<string, any>;
    setStartMessage(content: any): void;
    setInitiatedByUs(value: boolean): void;
    initiatedByUs: boolean;
    startMessage: any;
    cancelVerification(cancellationType: CancelTypes): Promise<void>;
} 

type Options = {
    hsApi: HomeServerApi;
    deviceTracker: DeviceTracker;
    otherUserId: string;
    platform: Platform;
    deviceMessageHandler: DeviceMessageHandler;
    log: ILogItem;
}

export class ToDeviceChannel implements IChannel {
    private readonly hsApi: HomeServerApi;
    private readonly deviceTracker: DeviceTracker;
    private readonly otherUserId: string;
    private readonly platform: Platform;
    private readonly deviceMessageHandler: DeviceMessageHandler;
    public readonly sentMessages: Map<string, any> = new Map();
    public readonly receivedMessages: Map<string, any> = new Map();
    public readonly localMessages: Map<string, any> = new Map();
    private readonly waitMap: Map<string, {resolve: any, promise: Promise<any>}> = new Map();
    private readonly log: ILogItem;
    public otherUserDeviceId: string;
    public startMessage: any;
    public id: string;
    private _initiatedByUs: boolean;

    /**
     * 
     * @param startingMessage Create the channel with existing message in the receivedMessage buffer
     */
    constructor(options: Options, startingMessage?: any) {
        this.hsApi = options.hsApi;
        this.deviceTracker = options.deviceTracker;
        this.otherUserId = options.otherUserId;
        this.platform = options.platform;
        this.log = options.log;
        this.deviceMessageHandler = options.deviceMessageHandler;
        // todo: find a way to dispose this subscription
        this.deviceMessageHandler.on("message", ({unencrypted}) => this.handleDeviceMessage(unencrypted))
        // Copy over request message
        if (startingMessage) {
            /**
             * startingMessage may be the ready message or the start message.
             */
            const eventType = startingMessage.content.method ? VerificationEventTypes.Start : VerificationEventTypes.Request;
            this.id = startingMessage.content.transaction_id;
            this.receivedMessages.set(eventType, startingMessage);
            this.otherUserDeviceId = startingMessage.content.from_device;
        }
    }

    get type() {
        return ChannelType.ToDeviceMessage;
    }

    async send(eventType: string, content: any, log: ILogItem): Promise<void> {
        await log.wrap("ToDeviceChannel.send", async () => {
            if (eventType === VerificationEventTypes.Request) {
                // Handle this case specially
                await this.handleRequestEventSpecially(eventType, content, log);
                this.sentMessages.set(eventType, {content});
                return;
            }
            Object.assign(content, { transaction_id: this.id });
            const payload = {
                messages: {
                    [this.otherUserId]: {
                        // check if the following is undefined?
                        [this.otherUserDeviceId]: content
                    }
                }
            }
            await this.hsApi.sendToDevice(eventType, payload, this.id, { log }).response();
            this.sentMessages.set(eventType, {content});
        });
    }

    async handleRequestEventSpecially(eventType: string, content: any, log: ILogItem) {
        await log.wrap("ToDeviceChannel.handleRequestEventSpecially", async () => {
            const timestamp = this.platform.clock.now();
            const txnId = makeTxnId();
            this.id = txnId;
            Object.assign(content, { timestamp, transaction_id: txnId });
            const payload = {
                messages: {
                    [this.otherUserId]: {
                        "*": content
                    }
                }
            }
            await this.hsApi.sendToDevice(eventType, payload, txnId, { log }).response();
        });
    }


    private handleDeviceMessage(event) {
        this.log.wrap("ToDeviceChannel.handleDeviceMessage", (log) => {
            console.log("event", event);
            log.set("event", event);
            this.resolveAnyWaits(event);
            this.receivedMessages.set(event.type, event);
            if (event.type === VerificationEventTypes.Ready) {
                this.handleReadyMessage(event, log);
            }
        });
    }

    private async handleReadyMessage(event, log: ILogItem) {
        try {
            const fromDevice = event.content.from_device;
            this.otherUserDeviceId = fromDevice;
            // We need to send cancel messages to all other devices
            const devices = await this.deviceTracker.devicesForUsers([this.otherUserId], this.hsApi, log);
            const otherDevices = devices.filter(device => device.deviceId !== fromDevice);
            const cancelMessage = {
                code: CancelTypes.OtherUserAccepted,
                reason: "An user already accepted this request!",
                transaction_id: this.id,
            };
            const deviceMessages = otherDevices.reduce((acc, device) => { acc[device.deviceId] = cancelMessage; return acc; }, {});
            const payload = {
                messages: {
                    [this.otherUserId]: deviceMessages
                }
            }
            await this.hsApi.sendToDevice(VerificationEventTypes.Cancel, payload, this.id, { log }).response();
        }
        catch (e) {
            console.log(e);
            // Do something here
        }
    } 

    async cancelVerification(cancellationType: CancelTypes) {
        await this.log.wrap("Channel.cancelVerification", async log => {
            const payload = {
                messages: {
                    [this.otherUserId]: {
                        [this.otherUserDeviceId]: {
                            code: cancellationType,
                            reason: messageFromErrorType[cancellationType],
                            transaction_id: this.id,
                        }
                    }
                }
            }
            await this.hsApi.sendToDevice(VerificationEventTypes.Cancel, payload, this.id, { log }).response();
        });
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
        // Check if we already received the message
        const receivedMessage = this.receivedMessages.get(eventType);
        if (receivedMessage) {
            return Promise.resolve(receivedMessage);
        }
        // Check if we're already waiting for this message
        const existingWait = this.waitMap.get(eventType);
        if (existingWait) {
            return existingWait.promise;
        }
        let resolve;
        // Add to wait map
        const promise = new Promise(r => {
            resolve = r;
        });
        this.waitMap.set(eventType, { resolve, promise });
        return promise;
    }

    setStartMessage(event) {
        this.startMessage = event;
    }

    setInitiatedByUs(value: boolean): void {
        this._initiatedByUs = value;
    }

    get initiatedByUs(): boolean {
        return this._initiatedByUs;
    };
} 
