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

import {BaseEntry} from "./BaseEntry";
import {Direction} from "../Direction";
import {isValidFragmentId} from "../common.js";
import {KeyLimits} from "../../../storage/common";

export class FragmentBoundaryEntry extends BaseEntry {
    constructor(fragment, isFragmentStart, fragmentIdComparer) {
        super(fragmentIdComparer);
        this._fragment = fragment;
        // TODO: should isFragmentStart be Direction instead of bool?
        this._isFragmentStart = isFragmentStart;
    }

    static start(fragment, fragmentIdComparer) {
        return new FragmentBoundaryEntry(fragment, true, fragmentIdComparer);
    }

    static end(fragment, fragmentIdComparer) {
        return new FragmentBoundaryEntry(fragment, false, fragmentIdComparer);
    }
    
    get started() {
        return this._isFragmentStart;
    }

    get hasEnded() {
        return !this.started;
    }

    get fragment() {
        return this._fragment;
    }

    get fragmentId() {
        return this._fragment.id;
    }

    get entryIndex() {
        if (this.started) {
            return KeyLimits.minStorageKey;
        } else {
            return KeyLimits.maxStorageKey;
        }
    }

    get isGap() {
        return !!this.token && !this.edgeReached;
    }

    get token() {
        if (this.started) {
            return this.fragment.previousToken;
        } else {
            return this.fragment.nextToken;
        }
    }

    set token(token) {
        if (this.started) {
            this.fragment.previousToken = token;
        } else {
            this.fragment.nextToken = token;
        }
    }

    get edgeReached() {
        if (this.started) {
            return this.fragment.startReached;
        } else {
            return this.fragment.endReached;
        }
    }

    set edgeReached(reached) {
        
        if (this.started) {
            this.fragment.startReached = reached;
        } else {
            this.fragment.endReached = reached;
        }
    }

    

    get linkedFragmentId() {
        if (this.started) {
            return this.fragment.previousId;
        } else {
            return this.fragment.nextId;
        }
    }

    set linkedFragmentId(id) {
        if (this.started) {
            this.fragment.previousId = id;
        } else {
            this.fragment.nextId = id;
        }
    }

    get hasLinkedFragment() {
        return isValidFragmentId(this.linkedFragmentId);
    }

    get direction() {
        if (this.started) {
            return Direction.Backward;
        } else {
            return Direction.Forward;
        }
    }

    withUpdatedFragment(fragment) {
        return new FragmentBoundaryEntry(fragment, this._isFragmentStart, this._fragmentIdComparer);
    }

    createNeighbourEntry(neighbour) {
        return new FragmentBoundaryEntry(neighbour, !this._isFragmentStart, this._fragmentIdComparer);
    }

    addLocalRelation() {}
    removeLocalRelation() {}
}
