/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {ILogItem} from "../../../../logging/types";
import {VerificationEventType} from "../channel/types";
import {createCalculateMAC} from "../mac";
import {VerifyMacStage} from "./VerifyMacStage";
import {getKeyEd25519Key, KeyUsage} from "../../CrossSigning";

export class SendMacStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("SendMacStage.completeStage", async (log) => {
            const acceptMessage = this.channel.acceptMessage.content;
            const macMethod = acceptMessage.message_authentication_code;
            const calculateMAC = createCalculateMAC(this.olmSAS, macMethod);
            await this.sendMAC(calculateMAC, log);
            await this.channel.waitForEvent(VerificationEventType.Mac);
            this.setNextStage(new VerifyMacStage(this.options));
        });
    }

    private async sendMAC(calculateMAC: (input: string, info: string, log: ILogItem) => string, log: ILogItem): Promise<void> {
        const mac: Record<string, string> = {};
        const keyList: string[] = [];
        const baseInfo =
            "MATRIX_KEY_VERIFICATION_MAC" +
            this.ourUserId +
            this.ourUserDeviceId +
            this.otherUserId +
            this.otherUserDeviceId +
            this.channel.id;

        const deviceKeyId = `ed25519:${this.ourUserDeviceId}`;
        const deviceKeys = this.e2eeAccount.getUnsignedDeviceKey();
        mac[deviceKeyId] = calculateMAC(deviceKeys.keys[deviceKeyId], baseInfo + deviceKeyId, log);
        keyList.push(deviceKeyId);

        const key = await this.deviceTracker.getCrossSigningKeyForUser(this.ourUserId, KeyUsage.Master, this.hsApi, log);
        if (!key) {
            log.log({ l: "Fetching msk failed", userId: this.ourUserId });
            throw new Error("Fetching MSK for user failed!");
        }
        const crossSigningKey = getKeyEd25519Key(key);
        if (crossSigningKey) {
            const crossSigningKeyId = `ed25519:${crossSigningKey}`;
            mac[crossSigningKeyId] = calculateMAC(crossSigningKey, baseInfo + crossSigningKeyId, log);
            keyList.push(crossSigningKeyId);
        }

        const keys = calculateMAC(keyList.sort().join(","), baseInfo + "KEY_IDS", log);
        await this.channel.send(VerificationEventType.Mac, { mac, keys }, log);
    }
}

