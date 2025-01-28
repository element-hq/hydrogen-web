/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {BaseSASVerificationStage} from "./BaseSASVerificationStage";
import {VerificationEventType} from "../channel/types";

export class SendDoneStage extends BaseSASVerificationStage {
    async completeStage() {
        await this.log.wrap("SendDoneStage.completeStage", async (log) => {
            await this.channel.send(VerificationEventType.Done, {}, log);
            await this.channel.waitForEvent(VerificationEventType.Done);
            this.eventEmitter.emit("VerificationCompleted", this.otherUserDeviceId);
        });
    }
}
