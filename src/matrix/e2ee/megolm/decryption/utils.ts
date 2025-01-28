/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {groupByWithCreator} from "../../../../utils/groupBy";
import type {TimelineEvent} from "../../../storage/types";

function getSenderKey(event: TimelineEvent): string | undefined {
    return event.content?.["sender_key"];
}

function getSessionId(event: TimelineEvent): string | undefined {
    return event.content?.["session_id"];
}

function getCiphertext(event: TimelineEvent): string | undefined {
    return event.content?.ciphertext;
}

export function validateEvent(event: TimelineEvent) {
    return typeof getSenderKey(event) === "string" &&
           typeof getSessionId(event) === "string" &&
           typeof getCiphertext(event) === "string";
}

export class SessionKeyGroup {
    public readonly events: TimelineEvent[];
    constructor() {
        this.events = [];
    }

    get senderKey(): string | undefined {
        return getSenderKey(this.events[0]!);
    }

    get sessionId(): string | undefined {
        return getSessionId(this.events[0]!);
    }
}

export function groupEventsBySession(events: TimelineEvent[]): Map<string, SessionKeyGroup> {
    return groupByWithCreator<string, TimelineEvent, SessionKeyGroup>(events,
        (event: TimelineEvent) => `${getSenderKey(event)}|${getSessionId(event)}`,
        () => new SessionKeyGroup(),
        (group: SessionKeyGroup, event: TimelineEvent) => group.events.push(event)
    );
}
