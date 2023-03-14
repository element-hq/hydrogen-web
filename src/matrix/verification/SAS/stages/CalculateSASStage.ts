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
import {generateEmojiSas} from "../generator";
import anotherjson from "another-json";
import { ILogItem } from "../../../../lib";
import { SendMacStage } from "./SendMacStage";

// From element-web
type KeyAgreement = "curve25519-hkdf-sha256" | "curve25519";
type MacMethod = "hkdf-hmac-sha256.v2" | "org.matrix.msc3783.hkdf-hmac-sha256" | "hkdf-hmac-sha256" | "hmac-sha256";

const KEY_AGREEMENT_LIST: KeyAgreement[] = ["curve25519-hkdf-sha256", "curve25519"];
const HASHES_LIST = ["sha256"];
const MAC_LIST: MacMethod[] = [
    "hkdf-hmac-sha256.v2",
    "org.matrix.msc3783.hkdf-hmac-sha256",
    "hkdf-hmac-sha256",
    "hmac-sha256",
];
const SAS_LIST = ["decimal", "emoji"];
const SAS_SET = new Set(SAS_LIST);


type SASUserInfo = {
    userId: string;
    deviceId: string;
    publicKey: string;
} 
type SASUserInfoCollection = {
    our: SASUserInfo;
    their: SASUserInfo;
    id: string;
    initiatedByMe: boolean;
};

const calculateKeyAgreement = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "curve25519-hkdf-sha256": function (sas: SASUserInfoCollection, olmSAS: Olm.SAS, bytes: number): Uint8Array {
        console.log("sas.requestId", sas.id);
        const ourInfo = `${sas.our.userId}|${sas.our.deviceId}|` + `${sas.our.publicKey}|`;
        const theirInfo = `${sas.their.userId}|${sas.their.deviceId}|${sas.their.publicKey}|`;
        console.log("ourInfo", ourInfo);
        console.log("theirInfo", theirInfo);
        const sasInfo =
            "MATRIX_KEY_VERIFICATION_SAS|" +
            (sas.initiatedByMe ? ourInfo + theirInfo : theirInfo + ourInfo) + sas.id;
        console.log("sasInfo", sasInfo);
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

    async completeStage() {
        await this.log.wrap("CalculateSASStage.completeStage", async (log) => {
            // 1. Check the hash commitment
            if (this.needsToVerifyHashCommitment) {
                if (!await this.verifyHashCommitment(log)) { return; }
            }
            // 2. Calculate the SAS
            const emojiConfirmationPromise: Promise<void> = new Promise(r => {
                this.resolve = r;
            });
            this.olmSAS.set_their_key(this.theirKey);
            const sasBytes = this.generateSASBytes();
            const emoji = generateEmojiSas(Array.from(sasBytes));
            console.log("Emoji calculated:", emoji);
            this.setNextStage(new SendMacStage(this.options));
        });
    }

    async verifyHashCommitment(log: ILogItem) {
        return await log.wrap("CalculateSASStage.verifyHashCommitment", async () => {
            const acceptMessage = this.channel.receivedMessages.get(VerificationEventTypes.Accept).content;
            const keyMessage = this.channel.receivedMessages.get(VerificationEventTypes.Key).content;
            const commitmentStr = keyMessage.key + anotherjson.stringify(this.channel.startMessage.content);
            const receivedCommitment = acceptMessage.commitment;
            const hash = this.olmUtil.sha256(commitmentStr);
            if (hash !== receivedCommitment) {
                log.set("Commitment mismatched!", {});
                // cancel the process!
                await this.channel.cancelVerification(CancelTypes.MismatchedCommitment);
                return false;
            }
            return true;
        });
    }

    private get needsToVerifyHashCommitment(): boolean {
        if (this.channel.initiatedByUs) {
            // If we sent the start message, we also received the accept message
            // The commitment is in the accept message, so we need to verify it.
            return true;
        }
        return false;
    }

    private generateSASBytes(): Uint8Array {
        const keyAgreement = this.channel.getEvent(VerificationEventTypes.Accept).content.key_agreement_protocol;
        const otherUserDeviceId = this.channel.otherUserDeviceId;
        const sasBytes = calculateKeyAgreement[keyAgreement]({
            our: {
                userId: this.ourUser.userId,
                deviceId: this.ourUser.deviceId,
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

    async emojiMatch(match: boolean) {
        if (!match) {
            // cancel the verification
            await this.channel.cancelVerification(CancelTypes.MismatchedSAS);
        }

    }

    get theirKey(): string {
        const { content } = this.channel.receivedMessages.get(VerificationEventTypes.Key);
        return content.key;
    }
}
