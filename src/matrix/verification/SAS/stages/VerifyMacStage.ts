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
import {ILogItem} from "../../../../lib";
import {VerificationEventTypes} from "../channel/types";
import {createCalculateMAC} from "../mac";
import type * as OlmNamespace from "@matrix-org/olm";
import {SendDoneStage} from "./SendDoneStage";
type Olm = typeof OlmNamespace;

export type KeyVerifier = (keyId: string, device: any, keyInfo: string) => void;

export class VerifyMacStage extends BaseSASVerificationStage {
    private calculateMAC: (input: string, info: string) => string;

    async completeStage() {
        await this.log.wrap("VerifyMacStage.completeStage", async (log) => {
            let acceptMessage;
            if (this.channel.initiatedByUs) {
                acceptMessage = this.channel.receivedMessages.get(VerificationEventTypes.Accept).content;
            }
            else {
                acceptMessage = this.channel.sentMessages.get(VerificationEventTypes.Accept).content;
            }
            const macMethod = acceptMessage.message_authentication_code;
            this.calculateMAC = createCalculateMAC(this.olmSAS, macMethod);
            await this.checkMAC(log);
            await this.channel.waitForEvent(VerificationEventTypes.Done);
            this.setNextStage(new SendDoneStage(this.options));
            this.dispose();
        });
    }

    private async checkMAC(log: ILogItem): Promise<void> {
        const {content} = this.channel.receivedMessages.get(VerificationEventTypes.Mac);
        const baseInfo =
            "MATRIX_KEY_VERIFICATION_MAC" +
            this.otherUserId +
            this.channel.otherUserDeviceId +
            this.ourUser.userId +
            this.ourUser.deviceId +
            this.channel.id;

        const calculatedMAC = this.calculateMAC(Object.keys(content.mac).sort().join(","), baseInfo + "KEY_IDS");
        if (content.keys !== calculatedMAC) {
            // todo: cancel when MAC does not match!
            console.log("Keys MAC Verification failed");
        }

        await this.verifyKeys(content.mac, (keyId, key, keyInfo) => {
            if (keyInfo !== this.calculateMAC(key, baseInfo + keyId)) {
                // todo: cancel when MAC does not match!
                console.log("mac obj MAC Verification failed");
            }
        }, log);
    }

    protected async verifyKeys(keys: Record<string, string>, verifier: KeyVerifier, log: ILogItem): Promise<void> {
        const userId = this.otherUserId;
        for (const [keyId, keyInfo] of Object.entries(keys)) {
            const deviceId = keyId.split(":", 2)[1];
            const device = await this.deviceTracker.deviceForId(userId, deviceId, this.hsApi, log);
            if (device) {
                verifier(keyId, device.ed25519Key, keyInfo);
                // todo: mark device as verified here
            } else {
                // If we were not able to find the device, then deviceId is actually the master signing key!
                const msk = deviceId;
                const {masterKey} = await this.deviceTracker.getCrossSigningKeysForUser(userId, this.hsApi, log);
                if (masterKey === msk) {
                    verifier(keyId, masterKey, keyInfo);
                    // todo: mark user as verified her
                } else {
                    // logger.warn(`verification: Could not find device ${deviceId} to verify`);
                }
            }
        }
    }
}
