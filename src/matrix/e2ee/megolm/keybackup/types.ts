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

import type * as Curve25519 from "./Curve25519";
import type {MEGOLM_ALGORITHM} from "../../common";

export type SignatureMap = {
    [userId: string]: {[deviceIdAndAlgorithm: string]: string}
}

export type BaseBackupInfo = {
    version: string,
    etag: string,
    count: number,
}

export type OtherBackupInfo = BaseBackupInfo & {
    algorithm: "other"
};

export type BackupInfo = Curve25519.BackupInfo | OtherBackupInfo;
export type SessionData = Curve25519.SessionData;

export type SessionInfo = {
    first_message_index: number,
    forwarded_count: number,
    is_verified: boolean,
    session_data: SessionData
}

export type MegOlmSessionKeyInfo = {
    algorithm: typeof MEGOLM_ALGORITHM,
    sender_key: string,
    sender_claimed_keys: {[algorithm: string]: string},
    forwarding_curve25519_key_chain: string[],
    session_key: string
}

// the type that session_data decrypts from / encrypts to
export type SessionKeyInfo = MegOlmSessionKeyInfo | {algorithm: string};

export type KeyBackupPayload = {
    rooms: {
        [roomId: string]: {
            sessions: {[sessionId: string]: SessionInfo}
        }
    }
}
