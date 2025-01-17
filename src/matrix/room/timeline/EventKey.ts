/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {KeyLimits} from "../../storage/common";
import {Direction} from "./Direction";

// key for events in the timelineEvents store
export class EventKey {
    constructor(
        public fragmentId: number,
        public eventIndex: number
    ) {
    }

    nextFragmentKey(): EventKey {
        // could take MIN_EVENT_INDEX here if it can't be paged back
        return new EventKey(this.fragmentId + 1, KeyLimits.middleStorageKey);
    }

    nextKeyForDirection(direction: Direction): EventKey {
        if (direction.isForward) {
            return this.nextKey();
        } else {
            return this.previousKey();
        }
    }

    previousKey(): EventKey {
        return new EventKey(this.fragmentId, this.eventIndex - 1);
    }

    nextKey(): EventKey {
        return new EventKey(this.fragmentId, this.eventIndex + 1);
    }

    static get maxKey(): EventKey {
        return new EventKey(KeyLimits.maxStorageKey, KeyLimits.maxStorageKey);
    }

    static get minKey(): EventKey {
        return new EventKey(KeyLimits.minStorageKey, KeyLimits.minStorageKey);
    }

    static get defaultLiveKey(): EventKey {
        return EventKey.defaultFragmentKey(KeyLimits.minStorageKey);
    }

    static defaultFragmentKey(fragmentId: number): EventKey {
        return new EventKey(fragmentId, KeyLimits.middleStorageKey);
    }

    toString(): string {
        return `[${this.fragmentId}/${this.eventIndex}]`;
    }

    equals(other: EventKey): boolean {
        return this.fragmentId === other?.fragmentId && this.eventIndex === other?.eventIndex;
    }
}
