/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {BaseObservableList} from "./BaseObservableList";

/* inline update of item in collection backed by array, without replacing the preexising item */
export function findAndUpdateInArray<T>(
    predicate: (value: T) => boolean,
    array: T[],
    observable: BaseObservableList<T>,
    updater: (value: T) => any | false
): boolean {
    const index = array.findIndex(predicate);
    if (index !== -1) {
        const value = array[index];
        // allow bailing out of sending an emit if updater determined its not needed
        const params = updater(value);
        if (params !== false) {
            observable.emitUpdate(index, value, params);
        }
        // found
        return true;
    }
    return false;
}
