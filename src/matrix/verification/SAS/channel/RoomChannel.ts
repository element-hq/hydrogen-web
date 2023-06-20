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
import type {IChannel} from "./IChannel";
import type {Room} from "../../../room/Room.js";
import type {EventEntry} from "../../../room/timeline/entries/EventEntry.js";
import {messageFromErrorType} from "./IChannel";
import {CancelReason, VerificationEventType} from "./types";
import {Disposables} from "../../../../utils/Disposables";
import {VerificationCancelledError} from "../VerificationCancelledError";
import {Deferred} from "../../../../utils/Deferred";
import {getRelatedEventId, createReference} from "../../../room/timeline/relations.js";

type Options = {
    otherUserId: string;
    ourUserId: string;
    log: ILogItem;
    ourUserDeviceId: string;
    room: Room;
}

export class RoomChannel extends Disposables implements IChannel {
    private ourDeviceId: string;
    private readonly otherUserId: string;
    private readonly sentMessages: Map<VerificationEventType, any> = new Map();
    private readonly receivedMessages: Map<VerificationEventType, any> = new Map();
    private readonly waitMap: Map<string, Deferred<any>> = new Map();
    private readonly log: ILogItem;
    private readonly room: Room;
    private readonly ourUserId: string;
    public otherUserDeviceId: string;
    public startMessage: any;
    /**
     * This is the event-id of the starting message (request/start)
     */
    public id: string;
    private _initiatedByUs: boolean;
    private _cancellation?: { code: CancelReason, cancelledByUs: boolean };

    /**
     * 
     * @param startingMessage Create the channel with existing message in the receivedMessage buffer
     */
    constructor(options: Options, startingMessage?: any) {
        super();
        this.otherUserId = options.otherUserId;
        this.ourUserId = options.ourUserId;
        this.ourDeviceId = options.ourUserDeviceId;
        this.log = options.log;
        this.room = options.room;
        this.subscribeToTimeline();
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
            this.id = startingMessage.id;
            const type = startingMessage.content?.msgtype ?? startingMessage.eventType;
            this.receivedMessages.set(type, startingMessage);
            this.otherUserDeviceId = startingMessage.content.from_device;
        }
    }

    private async subscribeToTimeline() {
        const timeline = await this.room.openTimeline();
        this.track(() => timeline.release());
        this.track(
           timeline.entries.subscribe({
                onAdd: async (_, entry: EventEntry) => {
                    this.handleRoomMessage(entry);
                },
                onRemove: () => { /** noop */ },
                onUpdate: () => { /** noop */ },
            })
        );
    }

    get cancellation(): IChannel["cancellation"] {
        return this._cancellation;
    };

    get isCancelled(): boolean {
        return !!this._cancellation;
    }

    async send(eventType: VerificationEventType, content: any, log: ILogItem): Promise<void> {
        await log.wrap("RoomChannel.send", async (_log) => {
            if (this.isCancelled) {
                throw new VerificationCancelledError();
            }
            if (eventType === VerificationEventType.Request) {
                // Handle this case specially
                await this.handleRequestEventSpecially(eventType, content, log);
                return;
            }
            if (!this.id) {
                /**
                 * This might happen if the user cancelled the verification from the UI,
                 * but no verification messages were yet sent (maybe because the keys are
                 * missing etc..).
                 */
                return;
            }
            await this.room.ensureMessageKeyIsShared(_log);
            Object.assign(content, createReference(this.id));
            await this.room.sendEvent(eventType, content, undefined, log);
            this.sentMessages.set(eventType, {content});
        });
    }

    private async handleRequestEventSpecially(eventType: VerificationEventType, content: any, log: ILogItem) {
        await log.wrap("RoomChannel.handleRequestEventSpecially", async () => {
            Object.assign(content, {
                body: `${this.otherUserId} is requesting to verify your key, but your client does not support in-chat key verification.  You will need to use legacy key verification to verify keys.`,
                msgtype: VerificationEventType.Request,
                to: this.otherUserId,
            });
            const pendingEvent = await this.room.sendEvent("m.room.message", content, undefined, log);
            this.id = await pendingEvent.getRemoteId();
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

    private async handleRoomMessage(entry: EventEntry) {
        const type = entry.content?.msgtype ?? entry.eventType;
        if (!type?.startsWith("m.key.verification") ||
            entry.sender === this.ourUserId ||
            entry.isLoadedFromStorage) {
            return; 
        }
        await this.log.wrap("RoomChannel.handleRoomMessage", async (log) => {
            if (!this.id) {
                throw new Error("Couldn't find event-id of request message!");
            }
            if (getRelatedEventId(entry.event) !== this.id) {
                /**
                 * When a device receives an unknown transaction_id, it should send an appropriate
                 * m.key.verification.cancel message to the other device indicating as such.
                 * This does not apply for inbound m.key.verification.start or m.key.verification.cancel messages.
                 */
                await this.cancelVerification(CancelReason.UnknownTransaction);
                return;
            }
            this.resolveAnyWaits(entry);
            this.receivedMessages.set(entry.eventType, entry);
            if (entry.eventType === VerificationEventType.Ready) {
                const fromDevice = entry.content.from_device;
                this.otherUserDeviceId = fromDevice;
                return;
            }
            if (entry.eventType === VerificationEventType.Cancel) {
                this._cancellation = { code: entry.content.code, cancelledByUs: false };
                this.dispose();
                return;
            }
        });
    }

    async cancelVerification(cancellationType: CancelReason) {
        await this.log.wrap("RoomChannel.cancelVerification", async log => {
            log.log({ reason: messageFromErrorType[cancellationType] });
            if (this.isCancelled) {
                throw new VerificationCancelledError();
            }
            const content = {
                code: cancellationType,
                reason: messageFromErrorType[cancellationType],
            }
            await this.send(VerificationEventType.Cancel, content, log);
            this._cancellation = { code: cancellationType, cancelledByUs: true };
            this.dispose();
        });
    }

    private resolveAnyWaits(entry: EventEntry) {
        const { eventType } = entry;
        const wait = this.waitMap.get(eventType);
        if (wait) {
            wait.resolve(entry);
            this.waitMap.delete(eventType);
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

    setStartMessage(entry) {
        if (!entry.content["m.relates_to"]) {
            const clone = entry.clone();
            clone.content["m.relates_to"] = clone.event.content["m.relates_to"];
            this.startMessage = clone;
        }
        else {
            this.startMessage = entry;
        }
        this._initiatedByUs = entry.content.from_device === this.ourDeviceId;
    }

    get initiatedByUs(): boolean {
        return this._initiatedByUs;
    };
} 
