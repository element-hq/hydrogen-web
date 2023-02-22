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
import anotherjson from "another-json";

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
    requestId: string;
};

const calculateKeyAgreement = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "curve25519-hkdf-sha256": function (sas: SASUserInfoCollection, olmSAS: Olm.SAS, bytes: number): Uint8Array {
        console.log("sas.requestId", sas.requestId);
        const ourInfo = `${sas.our.userId}|${sas.our.deviceId}|` + `${sas.our.publicKey}|`;
        const theirInfo = `${sas.their.userId}|${sas.their.deviceId}|${sas.their.publicKey}|`;
        console.log("ourInfo", ourInfo);
        console.log("theirInfo", theirInfo);
        const initiatedByMe = false;
        const sasInfo =
            "MATRIX_KEY_VERIFICATION_SAS|" +
            (initiatedByMe ? ourInfo + theirInfo : theirInfo + ourInfo) + sas.requestId;
        console.log("sasInfo", sasInfo);
        return olmSAS.generate_bytes(sasInfo, bytes);
    },
    "curve25519": function (sas: SASUserInfoCollection, olmSAS: Olm.SAS, bytes: number): Uint8Array {
        const ourInfo = `${sas.our.userId}${sas.our.deviceId}`;
        const theirInfo = `${sas.their.userId}${sas.their.deviceId}`;
        const initiatedByMe = false;
        const sasInfo =
            "MATRIX_KEY_VERIFICATION_SAS" +
            (initiatedByMe ? ourInfo + theirInfo : theirInfo + ourInfo) + sas.requestId;
        return olmSAS.generate_bytes(sasInfo, bytes);
    },
} as const;

export class SendKeyStage extends BaseSASVerificationStage {

    async completeStage() {
        await this.log.wrap("SendKeyStage.completeStage", async (log) => {
            const event = this.previousResult["m.key.verification.key"];
            const content = event.content;
            const theirKey = content.key;
            const ourSasKey = this.previousResult["our_pub_key"];
            console.log("ourSasKey", ourSasKey);
            const contentToSend = {
                key: ourSasKey,
                "m.relates_to": {
                    event_id: this.requestEventId,
                    rel_type: "m.reference",
                },
            };
            await this.room.sendEvent("m.key.verification.key", contentToSend, null, log);
            const keyAgreement = this.previousResult["m.key.verification.accept"].key_agreement_protocol;
            const otherUserDeviceId = this.previousResult["m.key.verification.start"].content.from_device;
            this.olmSAS.set_their_key(theirKey);
            const sasBytes = calculateKeyAgreement[keyAgreement]({
                our: {
                    userId: this.ourUser.userId,
                    deviceId: this.ourUser.deviceId,
                    publicKey: ourSasKey,
                },
                their: {
                    userId: this.otherUserId,
                    deviceId: otherUserDeviceId,
                    publicKey: theirKey,
                },
                requestId: this.requestEventId,
            }, this.olmSAS, 6);
            const emoji = generateEmojiSas(Array.from(sasBytes));
            console.log("emoji", emoji);
            this.dispose();
        });
    }


    get type() {
        return "m.key.verification.accept";
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

type EmojiMapping = [emoji: string, name: string];

const emojiMapping: EmojiMapping[] = [
    ["🐶", "dog"], //  0
    ["🐱", "cat"], //  1
    ["🦁", "lion"], //  2
    ["🐎", "horse"], //  3
    ["🦄", "unicorn"], //  4
    ["🐷", "pig"], //  5
    ["🐘", "elephant"], //  6
    ["🐰", "rabbit"], //  7
    ["🐼", "panda"], //  8
    ["🐓", "rooster"], //  9
    ["🐧", "penguin"], // 10
    ["🐢", "turtle"], // 11
    ["🐟", "fish"], // 12
    ["🐙", "octopus"], // 13
    ["🦋", "butterfly"], // 14
    ["🌷", "flower"], // 15
    ["🌳", "tree"], // 16
    ["🌵", "cactus"], // 17
    ["🍄", "mushroom"], // 18
    ["🌏", "globe"], // 19
    ["🌙", "moon"], // 20
    ["☁️", "cloud"], // 21
    ["🔥", "fire"], // 22
    ["🍌", "banana"], // 23
    ["🍎", "apple"], // 24
    ["🍓", "strawberry"], // 25
    ["🌽", "corn"], // 26
    ["🍕", "pizza"], // 27
    ["🎂", "cake"], // 28
    ["❤️", "heart"], // 29
    ["🙂", "smiley"], // 30
    ["🤖", "robot"], // 31
    ["🎩", "hat"], // 32
    ["👓", "glasses"], // 33
    ["🔧", "spanner"], // 34
    ["🎅", "santa"], // 35
    ["👍", "thumbs up"], // 36
    ["☂️", "umbrella"], // 37
    ["⌛", "hourglass"], // 38
    ["⏰", "clock"], // 39
    ["🎁", "gift"], // 40
    ["💡", "light bulb"], // 41
    ["📕", "book"], // 42
    ["✏️", "pencil"], // 43
    ["📎", "paperclip"], // 44
    ["✂️", "scissors"], // 45
    ["🔒", "lock"], // 46
    ["🔑", "key"], // 47
    ["🔨", "hammer"], // 48
    ["☎️", "telephone"], // 49
    ["🏁", "flag"], // 50
    ["🚂", "train"], // 51
    ["🚲", "bicycle"], // 52
    ["✈️", "aeroplane"], // 53
    ["🚀", "rocket"], // 54
    ["🏆", "trophy"], // 55
    ["⚽", "ball"], // 56
    ["🎸", "guitar"], // 57
    ["🎺", "trumpet"], // 58
    ["🔔", "bell"], // 59
    ["⚓️", "anchor"], // 60
    ["🎧", "headphones"], // 61
    ["📁", "folder"], // 62
    ["📌", "pin"], // 63
];

function generateEmojiSas(sasBytes: number[]): EmojiMapping[] {
    const emojis = [
        // just like base64 encoding
        sasBytes[0] >> 2,
        ((sasBytes[0] & 0x3) << 4) | (sasBytes[1] >> 4),
        ((sasBytes[1] & 0xf) << 2) | (sasBytes[2] >> 6),
        sasBytes[2] & 0x3f,
        sasBytes[3] >> 2,
        ((sasBytes[3] & 0x3) << 4) | (sasBytes[4] >> 4),
        ((sasBytes[4] & 0xf) << 2) | (sasBytes[5] >> 6),
    ];
    return emojis.map((num) => emojiMapping[num]);
}
