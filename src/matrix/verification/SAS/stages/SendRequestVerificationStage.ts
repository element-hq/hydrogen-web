/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {SelectVerificationMethodStage} from "./SelectVerificationMethodStage";
import {VerificationEventType} from "../channel/types";

export class SendRequestVerificationStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("SendRequestVerificationStage.completeStage", async (log) => {
            const content = {
                "from_device": this.ourUserDeviceId,
                "methods": ["m.sas.v1"],
            };
            await this.channel.send(VerificationEventType.Request, content, log);
            this.setNextStage(new SelectVerificationMethodStage(this.options));
            await this.channel.waitForEvent(VerificationEventType.Ready);
        });
    }
}
