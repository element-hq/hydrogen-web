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
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {CancelTypes, VerificationEventTypes} from "../channel/types";
import {KEY_AGREEMENT_LIST, HASHES_LIST, MAC_LIST, SAS_LIST} from "./constants";
import {SendAcceptVerificationStage} from "./SendAcceptVerificationStage";
import {SendKeyStage} from "./SendKeyStage";
import type {ILogItem} from "../../../../logging/types";

export class SelectVerificationMethodStage extends BaseSASVerificationStage {
    private hasSentStartMessage = false;
    private allowSelection = true;

    async completeStage() {
        await this.log.wrap("SelectVerificationMethodStage.completeStage", async (log) => {
            this.eventEmitter.emit("SelectVerificationStage", this);
            const startMessage = this.channel.waitForEvent(VerificationEventTypes.Start);
            const acceptMessage = this.channel.waitForEvent(VerificationEventTypes.Accept);
            const { content } = await Promise.race([startMessage, acceptMessage]);
            if (content.method) {
                // We received the start message 
                this.allowSelection = false;
                if (this.hasSentStartMessage) {
                    await this.resolveStartConflict(log);
                }
                else {
                    this.channel.setStartMessage(this.channel.receivedMessages.get(VerificationEventTypes.Start));
                }
            }
            else {
                // We received the accept message
                this.channel.setStartMessage(this.channel.sentMessages.get(VerificationEventTypes.Start));
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
            const receivedStartMessage = this.channel.receivedMessages.get(VerificationEventTypes.Start);
            const sentStartMessage = this.channel.sentMessages.get(VerificationEventTypes.Start);
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
                await this.channel.cancelVerification(CancelTypes.UnexpectedMessage);
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

    async selectEmojiMethod(log: ILogItem) {
        if (!this.allowSelection) { return; } 
        const content = {
            method: "m.sas.v1",
            from_device: this.ourUserDeviceId,
            key_agreement_protocols: KEY_AGREEMENT_LIST,
            hashes: HASHES_LIST,
            message_authentication_codes: MAC_LIST,
            short_authentication_string: SAS_LIST,
        };
        await this.channel.send(VerificationEventTypes.Start, content, log);
        this.hasSentStartMessage = true;
    }
}
