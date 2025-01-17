/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {CancelReason, VerificationEventType} from "../channel/types";
import {KEY_AGREEMENT_LIST, HASHES_LIST, MAC_LIST, SAS_LIST} from "./constants";
import {SendAcceptVerificationStage} from "./SendAcceptVerificationStage";
import {SendKeyStage} from "./SendKeyStage";
import {Deferred} from "../../../../utils/Deferred";
import type {ILogItem} from "../../../../logging/types";

export class SelectVerificationMethodStage extends BaseSASVerificationStage {
    private hasSentStartMessage?: Promise<void>;
    private allowSelection = true;
    public otherDeviceName: string;

    async completeStage() {
        await this.log.wrap("SelectVerificationMethodStage.completeStage", async (log) => {
            await this.findDeviceName(log);
            this.eventEmitter.emit("SelectVerificationStage", this);
            const startMessage = this.channel.waitForEvent(VerificationEventType.Start);
            const acceptMessage = this.channel.waitForEvent(VerificationEventType.Accept);
            const { content } = await Promise.race([startMessage, acceptMessage]);
            if (content.method) {
                // We received the start message 
                this.allowSelection = false;
                if (this.hasSentStartMessage) {
                    await this.hasSentStartMessage;
                    await this.resolveStartConflict(log);
                }
                else {
                    this.channel.setStartMessage(this.channel.getReceivedMessage(VerificationEventType.Start));
                }
            }
            else {
                // We received the accept message
                this.channel.setStartMessage(this.channel.getSentMessage(VerificationEventType.Start));
            }
            if (this.channel.initiatedByUs) {
                await acceptMessage;
                this.setNextStage(new SendKeyStage(this.options));
            }
            else {
                // We need to send the accept message next
                this.setNextStage(new SendAcceptVerificationStage(this.options));
            }
        });
    }

    private async resolveStartConflict(log: ILogItem) {
        await log.wrap("resolveStartConflict", async () => {
            const receivedStartMessage = this.channel.getReceivedMessage(VerificationEventType.Start);
            const sentStartMessage = this.channel.getSentMessage(VerificationEventType.Start);
            if (receivedStartMessage.content.method !== sentStartMessage.content.method) {
                /**
                 *  If the two m.key.verification.start messages do not specify the same verification method,
                 *  then the verification should be cancelled with a code of m.unexpected_message.
                 */
                log.log({
                    l: "Methods don't match for the start messages",
                    received: receivedStartMessage.content.method,
                    sent: sentStartMessage.content.method,
                });
                await this.channel.cancelVerification(CancelReason.UnexpectedMessage);
                return;
            }
            // In the case of conflict, the lexicographically smaller id wins 
            const our = this.ourUserId === this.otherUserId ? this.ourUserDeviceId : this.ourUserId;
            const their = this.ourUserId === this.otherUserId ? this.otherUserDeviceId : this.otherUserId;
            const startMessageToUse = our < their ? sentStartMessage : receivedStartMessage;
            log.log({ l: "Start message resolved", message: startMessageToUse, our, their })
            this.channel.setStartMessage(startMessageToUse);
        });
    }

    private async findDeviceName(log: ILogItem) {
        await log.wrap("SelectVerificationMethodStage.findDeviceName", async () => {
            const device = await this.options.deviceTracker.deviceForId(this.otherUserId, this.otherUserDeviceId, this.options.hsApi, log);
            if (!device) {
                log.log({ l: "Cannot find device", userId: this.otherUserId, deviceId: this.otherUserDeviceId });
                throw new Error("Cannot find device");
            }
            this.otherDeviceName = device.unsigned.device_display_name ?? device.device_id;
        })
    }

    async selectEmojiMethod(log: ILogItem) {
        if (!this.allowSelection) { return; } 
        const deferred = new Deferred<void>();
        this.hasSentStartMessage = deferred.promise;
        const content = {
            method: "m.sas.v1",
            from_device: this.ourUserDeviceId,
            key_agreement_protocols: KEY_AGREEMENT_LIST,
            hashes: HASHES_LIST,
            message_authentication_codes: MAC_LIST,
            short_authentication_string: SAS_LIST,
        };
        /**
         * Once we send the start event, we should eventually receive the accept message.
         * This will cause the Promise.race in completeStage() to resolve and we'll move
         * to the next stage (where we will send the key).
         */
        await this.channel.send(VerificationEventType.Start, content, log);
        deferred.resolve();
    }
}
