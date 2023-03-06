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
import type * as OlmNamespace from "@matrix-org/olm";
import {createCalculateMAC} from "../mac";
import {VerifyMacStage} from "./VerifyMacStage";
type Olm = typeof OlmNamespace;

export class SendMacStage extends BaseSASVerificationStage {
    private calculateMAC: (input: string, info: string) => string;

    async completeStage() {
        await this.log.wrap("SendMacStage.completeStage", async (log) => {
            let acceptMessage;
            if (this.channel.initiatedByUs) {
                acceptMessage = this.channel.receivedMessages.get(VerificationEventTypes.Accept).content;
            }
            else {
                acceptMessage = this.channel.sentMessages.get(VerificationEventTypes.Accept).content;
            }
            const macMethod = acceptMessage.message_authentication_code;
            this.calculateMAC = createCalculateMAC(this.olmSAS, macMethod);
            await this.sendMAC(log);
            await this.channel.waitForEvent(VerificationEventTypes.Mac);
            this._nextStage = new VerifyMacStage(this.options);
            this.dispose();
        });
    }

    private async sendMAC(log: ILogItem): Promise<void> {
        const mac: Record<string, string> = {};
        const keyList: string[] = [];
        const baseInfo =
            "MATRIX_KEY_VERIFICATION_MAC" +
            this.ourUser.userId +
            this.ourUser.deviceId +
            this.otherUserId +
            this.channel.otherUserDeviceId +
            this.channel.id;

        const deviceKeyId = `ed25519:${this.ourUser.deviceId}`;
        const deviceKeys = this.e2eeAccount.getDeviceKeysToSignWithCrossSigning();
        mac[deviceKeyId] = this.calculateMAC(deviceKeys.keys[deviceKeyId], baseInfo + deviceKeyId);
        keyList.push(deviceKeyId);

        const {masterKey: crossSigningKey} = await this.deviceTracker.getCrossSigningKeysForUser(this.ourUser.userId, this.hsApi, log);
        console.log("masterKey", crossSigningKey);
        if (crossSigningKey) {
            const crossSigningKeyId = `ed25519:${crossSigningKey}`;
            mac[crossSigningKeyId] = this.calculateMAC(crossSigningKey, baseInfo + crossSigningKeyId);
            keyList.push(crossSigningKeyId);
        }

        const keys = this.calculateMAC(keyList.sort().join(","), baseInfo + "KEY_IDS");
        console.log("result", mac, keys);
        await this.channel.send(VerificationEventTypes.Mac, { mac, keys }, log);
    }

    get type() {
        return "m.key.verification.accept";
    }
}

