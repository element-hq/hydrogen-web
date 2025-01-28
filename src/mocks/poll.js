/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export async function poll(fn) {
    do {
        const result = fn();
        if (result) {
            return result;
        } else {
            await new Promise(setImmediate); //eslint-disable-line no-undef
        }
    } while (1); //eslint-disable-line no-constant-condition
}