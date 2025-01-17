/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {OLM_ALGORITHM} from "../common";

export const enum OlmPayloadType {
    PreKey = 0,
    Normal = 1
}

export type OlmMessage = {
    type?: OlmPayloadType,
    body?: string
}

export type OlmEncryptedMessageContent = {
    algorithm?: typeof OLM_ALGORITHM
    sender_key?: string,
    ciphertext?: {
        [deviceCurve25519Key: string]: OlmMessage
    }
}

export type OlmEncryptedEvent = {
    type?: "m.room.encrypted",
    content?: OlmEncryptedMessageContent
    sender?: string
}

export type OlmPayload = {
    type?: string;
    content?: Record<string, any>;
    sender?: string;
    recipient?: string;
    recipient_keys?: {ed25519?: string};
    keys?: {ed25519?: string};
}
