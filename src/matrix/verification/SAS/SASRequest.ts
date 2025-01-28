/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {CrossSigning} from "../CrossSigning";
import type {Room} from "../../room/Room.js";
import type {ILogItem} from "../../../logging/types";

export class SASRequest {
    constructor(public readonly startingMessage: any) {}

    get deviceId(): string {
        return this.startingMessage.content.from_device;
    }

    get sender(): string {
        return this.startingMessage.sender;
    }

    get id(): string {
        return this.startingMessage.content.transaction_id ?? this.startingMessage.eventId;
    }

    async reject(crossSigning: CrossSigning, room: Room, log: ILogItem): Promise<void> {
        const sas = crossSigning.startVerification(this, room, log);
        await sas?.abort();
    }
}
