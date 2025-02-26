/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export async function estimateStorageUsage() {
    if (navigator?.storage?.estimate) {
        const {quota, usage} = await navigator.storage.estimate();
        return {quota, usage};
    } else {
        return {quota: null, usage: null};
    }
}
