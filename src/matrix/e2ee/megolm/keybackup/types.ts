/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
