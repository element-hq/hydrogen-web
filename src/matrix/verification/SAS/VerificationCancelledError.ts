/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class VerificationCancelledError extends Error {
    get name(): string  {
        return "VerificationCancelledError";
    }

    get message(): string {
        return "Verification is cancelled!";
    }
}
