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
import {generateEmojiSas} from "../generator";
import {ILogItem} from "../../../../lib";
import { VerificationEventTypes } from "../channel/types";

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

export class SendKeyStage extends BaseSASVerificationStage {

    async completeStage() {
        await this.log.wrap("SendKeyStage.completeStage", async (log) => {
            this.olmSAS.set_their_key(this.theirKey);
            const ourSasKey = this.olmSAS.get_pubkey();
            await this.sendKey(ourSasKey, log);
            const sasBytes = this.generateSASBytes();
            const emoji = generateEmojiSas(Array.from(sasBytes));
            console.log("emoji", emoji);
            this.dispose();
        });
    }

    private async sendKey(key: string, log: ILogItem): Promise<void> {
        const contentToSend = {
            key,
            // "m.relates_to": {
            //     event_id: this.requestEventId,
            //     rel_type: "m.reference",
            // },
        };
        await this.channel.send(VerificationEventTypes.Key, contentToSend, log);
        // await this.room.sendEvent("m.key.verification.key", contentToSend, null, log);
    }

    private generateSASBytes(): Uint8Array {
        const keyAgreement = this.channel.sentMessages.get(VerificationEventTypes.Accept).key_agreement_protocol;
        const otherUserDeviceId = this.channel.startMessage.content.from_device;
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

    get type() {
        return "m.key.verification.accept";
    }

    get theirKey(): string {
        const { content } = this.channel.receivedMessages.get(VerificationEventTypes.Key);
        return content.key;
    }
}

function intersection<T>(anArray: T[], aSet: Set<T>): T[] {
    return Array.isArray(anArray) ? anArray.filter((x) => aSet.has(x)) : [];
}

// function generateSas(sasBytes: Uint8Array, methods: string[]): IGeneratedSas {
//     const sas: IGeneratedSas = {};
//     for (const method of methods) {
//         if (method in sasGenerators) {
//             // @ts-ignore - ts doesn't like us mixing types like this
//             sas[method] = sasGenerators[method](Array.from(sasBytes));
//         }
//     }
//     return sas;
// }
