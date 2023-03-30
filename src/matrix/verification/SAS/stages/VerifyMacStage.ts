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
import {ILogItem} from "../../../../logging/types";
import {CancelReason, VerificationEventType} from "../channel/types";
import {createCalculateMAC} from "../mac";
import {SendDoneStage} from "./SendDoneStage";
import {KeyUsage, getKeyEd25519Key} from "../../CrossSigning";
import {getDeviceEd25519Key} from "../../../e2ee/common";

export type KeyVerifier = (keyId: string, publicKey: string, keyInfo: string) => boolean;

export class VerifyMacStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("VerifyMacStage.completeStage", async (log) => {
            const acceptMessage = this.channel.acceptMessage.content;
            const macMethod = acceptMessage.message_authentication_code;
            const calculateMAC = createCalculateMAC(this.olmSAS, macMethod);
            await this.checkMAC(calculateMAC, log);
            await this.channel.waitForEvent(VerificationEventType.Done);
            this.setNextStage(new SendDoneStage(this.options));
        });
    }

    private async checkMAC(calculateMAC: (input: string, info: string, log: ILogItem) => string, log: ILogItem): Promise<void> {
        const {content} = this.channel.getReceivedMessage(VerificationEventType.Mac);
        const baseInfo =
            "MATRIX_KEY_VERIFICATION_MAC" +
            this.otherUserId +
            this.otherUserDeviceId +
            this.ourUserId +
            this.ourUserDeviceId +
            this.channel.id;

        const calculatedMAC = calculateMAC(Object.keys(content.mac).sort().join(","), baseInfo + "KEY_IDS", log);
        if (content.keys !== calculatedMAC) {
            log.log({ l: "MAC verification failed for keys field", keys: content.keys, calculated: calculatedMAC });
            this.channel.cancelVerification(CancelReason.KeyMismatch);
            return;
        }

        await this.verifyKeys(content.mac, (keyId, key, keyInfo) => {
            const calculatedMAC = calculateMAC(key, baseInfo + keyId, log);
            const matches = keyInfo === calculatedMAC;
            if (!matches) {
                log.log({ l: "Mac verification failed for key", keyMac: keyInfo, calculatedMAC, keyId, key });
                this.channel.cancelVerification(CancelReason.KeyMismatch);
            }
            return matches;
        }, log);
    }

    protected async verifyKeys(keys: Record<string, string>, verifier: KeyVerifier, log: ILogItem): Promise<void> {
        const userId = this.otherUserId;
        for (const [keyId, keyInfo] of Object.entries(keys)) {
            const deviceIdOrMSK = keyId.split(":", 2)[1];
            const device = await this.deviceTracker.deviceForId(userId, deviceIdOrMSK, this.hsApi, log);
            if (device) {
                if (verifier(keyId, getDeviceEd25519Key(device), keyInfo)) {
                    await log.wrap("signing device", async log => {
                        const signedKey = await this.options.crossSigning.signDevice(device.device_id, log);
                        log.set("success", !!signedKey);
                    });
                }
            } else {
                // If we were not able to find the device, then deviceIdOrMSK is actually the MSK!
                const key = await this.deviceTracker.getCrossSigningKeyForUser(userId, KeyUsage.Master, this.hsApi, log);
                if (!key) {
                    log.log({ l: "Fetching msk failed", userId });
                    throw new Error("Fetching MSK for user failed!");
                }
                const masterKey = getKeyEd25519Key(key);
                if(masterKey && verifier(keyId, masterKey, keyInfo)) {
                    await log.wrap("signing user", async log => {
                        const signedKey = await this.options.crossSigning.signUser(userId, log);
                        log.set("success", !!signedKey);
                    });
                }
            }
        }
    }
}
