/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

//entries can be sorted, first by fragment, then by entry index.
import {EventKey} from "../EventKey";
export const PENDING_FRAGMENT_ID = Number.MAX_SAFE_INTEGER;

interface FragmentIdComparer {
    compare: (a: number, b: number) => number
}

export abstract class BaseEntry {
    constructor(
        protected readonly _fragmentIdComparer: FragmentIdComparer
    ) {
    }

    abstract get fragmentId(): number;
    abstract get entryIndex(): number;
    abstract updateFrom(other: BaseEntry): void;

    compare(otherEntry: BaseEntry): number {
        if (this.fragmentId === otherEntry.fragmentId) {
            return this.entryIndex - otherEntry.entryIndex;
        } else if (this.fragmentId === PENDING_FRAGMENT_ID) {
            return 1;
        } else if (otherEntry.fragmentId === PENDING_FRAGMENT_ID) {
            return -1;
        } else {
            // This might throw if the relation of two fragments is unknown.
            return this._fragmentIdComparer.compare(this.fragmentId, otherEntry.fragmentId);
        }
    }

    asEventKey(): EventKey {
        return new EventKey(this.fragmentId, this.entryIndex);
    }
}
