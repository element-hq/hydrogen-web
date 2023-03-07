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
import {Disposables} from "../../../../lib";
import {VerificationCancelledError} from "../VerificationCancelledError";

const messageFromErrorType = {
    [CancelTypes.UserCancelled]: "User declined",
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
    setStartMessage(content: any): void;
    setInitiatedByUs(value: boolean): void;
    initiatedByUs: boolean;
    startMessage: any;
    cancelVerification(cancellationType: CancelTypes): Promise<void>;
    getEvent(eventType: VerificationEventTypes.Accept): any;
} 

type Options = {
    hsApi: HomeServerApi;
    deviceTracker: DeviceTracker;
    otherUserId: string;
    platform: Platform;
    deviceMessageHandler: DeviceMessageHandler;
    log: ILogItem;
}

export class ToDeviceChannel extends Disposables implements IChannel {
    private readonly hsApi: HomeServerApi;
    private readonly deviceTracker: DeviceTracker;
    private readonly otherUserId: string;
    private readonly platform: Platform;
    private readonly deviceMessageHandler: DeviceMessageHandler;
    public readonly sentMessages: Map<string, any> = new Map();
    public readonly receivedMessages: Map<string, any> = new Map();
    private readonly waitMap: Map<string, {resolve: any, reject: any, promise: Promise<any>}> = new Map();
    private readonly log: ILogItem;
    public otherUserDeviceId: string;
    public startMessage: any;
    public id: string;
    private _initiatedByUs: boolean;
    private _isCancelled = false;

    /**
     * 
     * @param startingMessage Create the channel with existing message in the receivedMessage buffer
     */
    constructor(options: Options, startingMessage?: any) {
        super();
        this.hsApi = options.hsApi;
        this.deviceTracker = options.deviceTracker;
        this.otherUserId = options.otherUserId;
        this.platform = options.platform;
        this.log = options.log;
        this.deviceMessageHandler = options.deviceMessageHandler;
        // todo: find a way to dispose this subscription
        this.track(this.deviceMessageHandler.disposableOn("message", ({ unencrypted }) => this.handleDeviceMessage(unencrypted)));
        this.track(() => {
            this.waitMap.forEach((value) => { value.reject(new VerificationCancelledError()); });
        });
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
        (window as any).foo = () => this.cancelVerification(CancelTypes.OtherUserAccepted);
    }

    get type() {
        return ChannelType.ToDeviceMessage;
    }

    get isCancelled(): boolean {
        return this._isCancelled;
    }

    async send(eventType: string, content: any, log: ILogItem): Promise<void> {
        await log.wrap("ToDeviceChannel.send", async () => {
            if (this.isCancelled) {
                throw new VerificationCancelledError();
            }
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
            await this.hsApi.sendToDevice(eventType, payload, makeTxnId(), { log }).response();
            this.sentMessages.set(eventType, {content});
        });
    }

    private async handleRequestEventSpecially(eventType: string, content: any, log: ILogItem) {
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
            await this.hsApi.sendToDevice(eventType, payload, makeTxnId(), { log }).response();
        });
    }

    getEvent(eventType: VerificationEventTypes.Accept) {
        return this.receivedMessages.get(eventType) ?? this.sentMessages.get(eventType);
    }


    private handleDeviceMessage(event) {
        this.log.wrap("ToDeviceChannel.handleDeviceMessage", (log) => {
            console.log("event", event);
            log.set("event", event);
            this.resolveAnyWaits(event);
            this.receivedMessages.set(event.type, event);
            if (event.type === VerificationEventTypes.Ready) {
                this.handleReadyMessage(event, log);
                return;
            }
            if (event.type === VerificationEventTypes.Cancel) {
                this.dispose();
                return;
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
            await this.hsApi.sendToDevice(VerificationEventTypes.Cancel, payload, makeTxnId(), { log }).response();
        }
        catch (e) {
            console.log(e);
            // Do something here
        }
    } 

    async cancelVerification(cancellationType: CancelTypes) {
        await this.log.wrap("Channel.cancelVerification", async log => {
            if (this.isCancelled) {
                throw new VerificationCancelledError();
            }
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
            await this.hsApi.sendToDevice(VerificationEventTypes.Cancel, payload, makeTxnId(), { log }).response();
            this._isCancelled = true;
            this.dispose();
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
        let resolve, reject;
        // Add to wait map
        const promise = new Promise((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
        });
        this.waitMap.set(eventType, { resolve, reject, promise });
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
