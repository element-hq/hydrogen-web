/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
