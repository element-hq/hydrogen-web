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
