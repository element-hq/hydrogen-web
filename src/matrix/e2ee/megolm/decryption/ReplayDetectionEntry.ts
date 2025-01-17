/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {TimelineEvent} from "../../../storage/types";

export class ReplayDetectionEntry {
    public readonly sessionId: string;
    public readonly messageIndex: number;
    public readonly event: TimelineEvent;

    constructor(sessionId: string, messageIndex: number, event: TimelineEvent) {
        this.sessionId = sessionId;
        this.messageIndex = messageIndex;
        this.event = event;
    }

    get eventId(): string {
        return this.event.event_id;
    }

    get timestamp(): number {
        return this.event.origin_server_ts;
    }
}
