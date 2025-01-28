/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {VerificationEventType} from "../channel/types";
import {CalculateSASStage} from "./CalculateSASStage";

export class SendKeyStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("SendKeyStage.completeStage", async (log) => {
            const ourSasKey = this.olmSAS.get_pubkey();
            await this.channel.send(VerificationEventType.Key, {key: ourSasKey}, log);
            /**
             * We may have already got the key in SendAcceptVerificationStage,
             * in which case waitForEvent will return a resolved promise with
             * that content. Otherwise, waitForEvent will actually wait for the
             * key message.
             */
            await this.channel.waitForEvent(VerificationEventType.Key);
            this.setNextStage(new CalculateSASStage(this.options));
        });
    }
}
