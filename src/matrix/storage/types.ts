/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export type Content = { [key: string]: any }

export interface TimelineEvent {
    content: Content;
    type: string;
    event_id: string;
    sender: string;
    origin_server_ts: number;
    unsigned?: Content;
}

export type StateEvent = TimelineEvent & { prev_content?: Content, state_key: string }
