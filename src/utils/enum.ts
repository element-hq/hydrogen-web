/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function createEnum(...values: string[]): Readonly<{}> {
    const obj = {};
    for (const value of values) {
        obj[value] = value;
    }
    return Object.freeze(obj);
}
