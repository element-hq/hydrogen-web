/*
Copyright 2025 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/


/**
 * This function is similar to Object.assign() but it assigns recursively and
 * allows you to ignore nullish values from the source
 *
 * @param {Object} target
 * @param {Object} source
 * @returns the target object
 */
export function recursivelyAssign(target: Object, source: Object, ignoreNullish = false): any {
    for (const [sourceKey, sourceValue] of Object.entries(source)) {
        if (target[sourceKey] instanceof Object && sourceValue) {
            recursivelyAssign(target[sourceKey], sourceValue);
            continue;
        }
        if ((sourceValue !== null && sourceValue !== undefined) || !ignoreNullish) {
            target[sourceKey] = sourceValue;
            continue;
        }
    }
    return target;
}