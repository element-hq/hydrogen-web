/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function comparePrimitive(a, b) {
    if (a === b) {
        return 0;
    } else {
        return a < b ? -1 : 1;
    }
}
