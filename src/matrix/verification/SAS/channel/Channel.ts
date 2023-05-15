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
import type {Clock} from "../../../../platform/web/dom/Clock.js";
import type {DeviceMessageHandler} from "../../../DeviceMessageHandler.js";
import {makeTxnId} from "../../../common.js";
import {CancelReason, VerificationEventType} from "./types";
import {Disposables} from "../../../../utils/Disposables";
import {VerificationCancelledError} from "../VerificationCancelledError";
import {Deferred} from "../../../../utils/Deferred";

const messageFromErrorType = {
    [CancelReason.UserCancelled]: "User declined",
    [CancelReason.InvalidMessage]: "Invalid Message.",
    [CancelReason.KeyMismatch]: "Key Mismatch.",
    [CancelReason.OtherDeviceAccepted]: "Another device has accepted this request.",
    [CancelReason.TimedOut]: "Timed Out",
    [CancelReason.UnexpectedMessage]: "Unexpected Message.",
    [CancelReason.UnknownMethod]: "Unknown method.",
    [CancelReason.UnknownTransaction]: "Unknown Transaction.",
    [CancelReason.UserMismatch]: "User Mismatch",
    [CancelReason.MismatchedCommitment]: "Hash commitment does not match.",
    [CancelReason.MismatchedSAS]: "Emoji/decimal does not match.",
}

export interface IChannel {
    send(eventType: VerificationEventType, content: any, log: ILogItem): Promise<void>;
    waitForEvent(eventType: VerificationEventType): Promise<any>;
    getSentMessage(event: VerificationEventType): any;
    getReceivedMessage(event: VerificationEventType): any;
    setStartMessage(content: any): void;
    cancelVerification(cancellationType: CancelReason): Promise<void>;
    acceptMessage: any;
    startMessage: any;
    initiatedByUs: boolean;
    isCancelled: boolean;
    cancellation?: { code: CancelReason, cancelledByUs: boolean };
    id: string;
    otherUserDeviceId: string;
} 

type Options = {
    hsApi: HomeServerApi;
    deviceTracker: DeviceTracker;
    otherUserId: string;
    clock: Clock;
    deviceMessageHandler: DeviceMessageHandler;
    log: ILogItem;
    ourUserDeviceId: string;
}

export class ToDeviceChannel extends Disposables implements IChannel {
    private readonly hsApi: HomeServerApi;
    private readonly deviceTracker: DeviceTracker;
    private ourDeviceId: string;
    private readonly otherUserId: string;
    private readonly clock: Clock;
    private readonly deviceMessageHandler: DeviceMessageHandler;
    private readonly sentMessages: Map<VerificationEventType, any> = new Map();
    private readonly receivedMessages: Map<VerificationEventType, any> = new Map();
    private readonly waitMap: Map<string, Deferred<any>> = new Map();
    private readonly log: ILogItem;
    public otherUserDeviceId: string;
    public startMessage: any;
    public id: string;
    private _initiatedByUs: boolean;
    private _cancellation?: { code: CancelReason, cancelledByUs: boolean };

    /**
     * 
     * @param startingMessage Create the channel with existing message in the receivedMessage buffer
     */
    constructor(options: Options, startingMessage?: any) {
        super();
        this.hsApi = options.hsApi;
        this.deviceTracker = options.deviceTracker;
        this.otherUserId = options.otherUserId;
        this.ourDeviceId = options.ourUserDeviceId;
        this.clock = options.clock;
        this.log = options.log;
        this.deviceMessageHandler = options.deviceMessageHandler;
        this.track(
            this.deviceMessageHandler.disposableOn(
                "message",
                async ({ unencrypted }) =>
                    await this.handleDeviceMessage(unencrypted)
            )
        );
        this.track(() => {
            this.waitMap.forEach((value) => {
                value.reject(new VerificationCancelledError());
            });
        });
        // Copy over request message
        if (startingMessage) {
            /**
             * startingMessage may be the ready message or the start message.
             */
            this.id = startingMessage.content.transaction_id;
            this.receivedMessages.set(startingMessage.type, startingMessage);
            this.otherUserDeviceId = startingMessage.content.from_device;
        }
    }

    get cancellation(): IChannel["cancellation"] {
        return this._cancellation;
    };

    get isCancelled(): boolean {
        return !!this._cancellation;
    }

    async send(eventType: VerificationEventType, content: any, log: ILogItem): Promise<void> {
        await log.wrap("ToDeviceChannel.send", async () => {
            if (this.isCancelled) {
                throw new VerificationCancelledError();
            }
            if (eventType === VerificationEventType.Request) {
                // Handle this case specially
                await this.handleRequestEventSpecially(eventType, content, log);
                return;
            }
            Object.assign(content, { transaction_id: this.id });
            const payload = {
                messages: {
                    [this.otherUserId]: {
                        [this.otherUserDeviceId]: content
                    }
                }
            }
            await this.hsApi.sendToDevice(eventType, payload, makeTxnId(), { log }).response();
            this.sentMessages.set(eventType, {content});
        });
    }

    private async handleRequestEventSpecially(eventType: VerificationEventType, content: any, log: ILogItem) {
        await log.wrap("ToDeviceChannel.handleRequestEventSpecially", async () => {
            const timestamp = this.clock.now();
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
            this.sentMessages.set(eventType, {content});
        });
    }

    getReceivedMessage(event: VerificationEventType) {
        return this.receivedMessages.get(event);
    }

    getSentMessage(event: VerificationEventType) {
        return this.sentMessages.get(event);
    }

    get acceptMessage(): any {
        return this.receivedMessages.get(VerificationEventType.Accept) ??
            this.sentMessages.get(VerificationEventType.Accept);
    }


    private async handleDeviceMessage(event) {
        await this.log.wrap("ToDeviceChannel.handleDeviceMessage", async (log) => {
            if (!event.type.startsWith("m.key.verification.")) {
                return;
            }
            if (event.content.transaction_id !== this.id) {
                /**
                 * When a device receives an unknown transaction_id, it should send an appropriate
                 * m.key.verification.cancel message to the other device indicating as such.
                 * This does not apply for inbound m.key.verification.start or m.key.verification.cancel messages.
                 */
                console.log("Received event with unknown transaction id: ", event);
                await this.cancelVerification(CancelReason.UnknownTransaction);
                return;
            }
            console.log("event", event);
            log.log({ l: "event", event });
            this.resolveAnyWaits(event);
            this.receivedMessages.set(event.type, event);
            if (event.type === VerificationEventType.Ready) {
                this.handleReadyMessage(event, log);
                return;
            }
            if (event.type === VerificationEventType.Cancel) {
                this._cancellation = { code: event.content.code, cancelledByUs: false };
                this.dispose();
                return;
            }
        });
    }

    private async handleReadyMessage(event, log: ILogItem) {
        const fromDevice = event.content.from_device;
        this.otherUserDeviceId = fromDevice;
        // We need to send cancel messages to all other devices
        const devices = await this.deviceTracker.devicesForUsers([this.otherUserId], this.hsApi, log);
        const otherDevices = devices.filter(device => device.device_id !== fromDevice && device.device_id !== this.ourDeviceId);
        const cancelMessage = {
            code: CancelReason.OtherDeviceAccepted,
            reason: messageFromErrorType[CancelReason.OtherDeviceAccepted],
            transaction_id: this.id,
        };
        const deviceMessages = otherDevices.reduce((acc, device) => { acc[device.device_id] = cancelMessage; return acc; }, {});
        const payload = {
            messages: {
                [this.otherUserId]: deviceMessages
            }
        }
        await this.hsApi.sendToDevice(VerificationEventType.Cancel, payload, makeTxnId(), { log }).response();
    }

    async cancelVerification(cancellationType: CancelReason) {
        await this.log.wrap("Channel.cancelVerification", async log => {
            if (this.isCancelled) {
                throw new VerificationCancelledError();
            }
            const payload = {
                messages: {
                    [this.otherUserId]: {
                        [this.otherUserDeviceId ?? "*"]: {
                            code: cancellationType,
                            reason: messageFromErrorType[cancellationType],
                            transaction_id: this.id,
                        }
                    }
                }
            }
            await this.hsApi.sendToDevice(VerificationEventType.Cancel, payload, makeTxnId(), { log }).response();
            this._cancellation = { code: cancellationType, cancelledByUs: true };
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

    waitForEvent(eventType: VerificationEventType): Promise<any> {
        if (this.isCancelled) {
            throw new VerificationCancelledError();
        }
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
        const deferred = new Deferred(); 
        this.waitMap.set(eventType, deferred);
        return deferred.promise;
    }

    setStartMessage(event) {
        this.startMessage = event;
        this._initiatedByUs = event.content.from_device === this.ourDeviceId;
    }

    get initiatedByUs(): boolean {
        return this._initiatedByUs;
    };
} 
