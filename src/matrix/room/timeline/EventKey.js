/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {KeyLimits} from "../../storage/common.js";

// key for events in the timelineEvents store
export class EventKey {
    constructor(fragmentId, eventIndex) {
        this.fragmentId = fragmentId;
        this.eventIndex = eventIndex;
    }

    nextFragmentKey() {
        // could take MIN_EVENT_INDEX here if it can't be paged back
        return new EventKey(this.fragmentId + 1, KeyLimits.middleStorageKey);
    }

    nextKeyForDirection(direction) {
        if (direction.isForward) {
            return this.nextKey();
        } else {
            return this.previousKey();
        }
    }

    previousKey() {
        return new EventKey(this.fragmentId, this.eventIndex - 1);
    }

    nextKey() {
        return new EventKey(this.fragmentId, this.eventIndex + 1);
    }

    static get maxKey() {
        return new EventKey(KeyLimits.maxStorageKey, KeyLimits.maxStorageKey);
    }

    static get minKey() {
        return new EventKey(KeyLimits.minStorageKey, KeyLimits.minStorageKey);
    }

    static get defaultLiveKey() {
        return EventKey.defaultFragmentKey(KeyLimits.minStorageKey);
    }

    static defaultFragmentKey(fragmentId) {
        return new EventKey(fragmentId, KeyLimits.middleStorageKey);
    }

    toString() {
        return `[${this.fragmentId}/${this.eventIndex}]`;
    }

    equals(other) {
        return this.fragmentId === other?.fragmentId && this.eventIndex === other?.eventIndex;
    }
}
