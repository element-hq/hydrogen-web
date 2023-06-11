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
import anotherjson from "another-json";
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {CancelReason, VerificationEventType} from "../channel/types";
import {generateEmojiSas} from "../generator";
import {ILogItem} from "../../../../logging/types";
import {SendMacStage} from "./SendMacStage";
import {VerificationCancelledError} from "../VerificationCancelledError";

type SASUserInfo = {
    userId: string;
    deviceId: string;
    publicKey: string;
};

type SASUserInfoCollection = {
    our: SASUserInfo;
    their: SASUserInfo;
    id: string;
    initiatedByMe: boolean;
};

const calculateKeyAgreement = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "curve25519-hkdf-sha256": function (sas: SASUserInfoCollection, olmSAS: Olm.SAS, bytes: number): Uint8Array {
        const ourInfo = `${sas.our.userId}|${sas.our.deviceId}|` + `${sas.our.publicKey}|`;
        const theirInfo = `${sas.their.userId}|${sas.their.deviceId}|${sas.their.publicKey}|`;
        const sasInfo =
            "MATRIX_KEY_VERIFICATION_SAS|" +
            (sas.initiatedByMe ? ourInfo + theirInfo : theirInfo + ourInfo) + sas.id;
        return olmSAS.generate_bytes(sasInfo, bytes);
    },
    "curve25519": function (sas: SASUserInfoCollection, olmSAS: Olm.SAS, bytes: number): Uint8Array {
        const ourInfo = `${sas.our.userId}${sas.our.deviceId}`;
        const theirInfo = `${sas.their.userId}${sas.their.deviceId}`;
        const sasInfo =
            "MATRIX_KEY_VERIFICATION_SAS" +
            (sas.initiatedByMe ? ourInfo + theirInfo : theirInfo + ourInfo) + sas.id;
        return olmSAS.generate_bytes(sasInfo, bytes);
    },
} as const;

export class CalculateSASStage extends BaseSASVerificationStage {
    private resolve: () => void;
    private reject: (error: VerificationCancelledError) => void;

    public emoji: ReturnType<typeof generateEmojiSas>;

    async completeStage() {
        await this.log.wrap("CalculateSASStage.completeStage", async (log) => {
            // 1. Check the hash commitment
            if (this.channel.initiatedByUs && !await this.verifyHashCommitment(log)) {
                return;
            }
            // 2. Calculate the SAS
            const emojiConfirmationPromise: Promise<void> = new Promise((res, rej) => {
                this.resolve = res;
                this.reject = rej;
            });
            this.olmSAS.set_their_key(this.theirKey);
            const sasBytes = this.generateSASBytes();
            this.emoji = generateEmojiSas(Array.from(sasBytes));
            this.eventEmitter.emit("EmojiGenerated", this);
            const cancellationReceived = this.channel.waitForEvent(VerificationEventType.Cancel);
            // Don't get stuck on waiting for user input!
            await Promise.race([emojiConfirmationPromise, cancellationReceived]);
            this.setNextStage(new SendMacStage(this.options));
        });
    }

    async verifyHashCommitment(log: ILogItem) {
        return await log.wrap("CalculateSASStage.verifyHashCommitment", async () => {
            const acceptMessage = this.channel.getReceivedMessage(VerificationEventType.Accept).content;
            const keyMessage = this.channel.getReceivedMessage(VerificationEventType.Key).content;
            const commitmentStr = keyMessage.key + anotherjson.stringify(this.channel.startMessage.content);
            const receivedCommitment = acceptMessage.commitment;
            const hash = this.olmUtil.sha256(commitmentStr);
            if (hash !== receivedCommitment) {
                log.log({l: "Commitment mismatched!", received: receivedCommitment, calculated: hash});
                await this.channel.cancelVerification(CancelReason.MismatchedCommitment);
                return false;
            }
            return true;
        });
    }

    private generateSASBytes(): Uint8Array {
        const keyAgreement = this.channel.acceptMessage.content.key_agreement_protocol;
        const otherUserDeviceId = this.otherUserDeviceId;
        const sasBytes = calculateKeyAgreement[keyAgreement]({
            our: {
                userId: this.ourUserId,
                deviceId: this.ourUserDeviceId,
                publicKey: this.olmSAS.get_pubkey(),
            },
            their: {
                userId: this.otherUserId,
                deviceId: otherUserDeviceId,
                publicKey: this.theirKey,
            },
            id: this.channel.id,
            initiatedByMe: this.channel.initiatedByUs,
        }, this.olmSAS, 6);
        return sasBytes;
    }

    async setEmojiMatch(match: boolean) {
        if (match) {
            this.resolve();
        }
        else {
            await this.channel.cancelVerification(CancelReason.MismatchedSAS);
            this.reject(new VerificationCancelledError());
        }
    }

    get theirKey(): string {
        const {content} = this.channel.getReceivedMessage(VerificationEventType.Key);
        return content.key;
    }
}
