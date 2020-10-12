/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {ObservableValue} from "../../observable/ObservableValue.js";

export class Navigation {
    constructor(allowsChild) {
        this._allowsChild = allowsChild;
        this._path = new Path([], allowsChild);
        this._observables = new Map();
    }

    get path() {
        return this._path;
    }

    applyPath(path) {
        const oldPath = this._path;
        this._path = path;
        // clear values not in the new path in reverse order of path
        for (let i = oldPath.segments.length - 1; i >= 0; i -= 1) {
            const segment = oldPath[i];
            if (!this._path.get(segment.type)) {
                const observable = this._observables.get(segment.type);
                if (observable) {
                    observable.set(segment.type, undefined);
                }
            }
        }
        // change values in order of path
        for (const segment of this._path.segments) {
            const observable = this._observables.get(segment.type);
            if (observable) {
                if (!segmentValueEqual(segment?.value, observable.get())) {
                    observable.set(segment.type, segment.value);
                }
            }
        }
    }

    observe(type) {
        let observable = this._observables.get(type);
        if (!observable) {
            observable = new ObservableValue(this._path.get(type)?.value);
            this._observables.set(type, observable);
        }
        return observable;
    }

    pathFrom(segments) {
        let parent;
        let i;
        for (i = 0; i < segments.length; i += 1) {
            if (!this._allowsChild(parent, segments[i])) {
                return new Path(segments.slice(0, i), this._allowsChild);
            }
            parent = segments[i];
        }
        return new Path(segments, this._allowsChild);
    }

    segment(type, value) {
        return new Segment(type, value);
    }
}

function segmentValueEqual(a, b) {
    if (a === b) {
        return true;
    }
    // allow (sparse) arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i += 1) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export class Segment {
    constructor(type, value) {
        this.type = type;
        this.value = value === undefined ? true : value;
    }
}

class Path {
    constructor(segments = [], allowsChild) {
        this._segments = segments;
        this._allowsChild = allowsChild;
    }

    clone() {
        return new Path(this._segments.slice(), this._allowsChild);
    }

    with(segment) {
        let index = this._segments.length - 1;
        do {
            if (this._allowsChild(this._segments[index], segment)) {
                // pop the elements that didn't allow the new segment as a child
                const newSegments = this._segments.slice(0, index + 1);
                newSegments.push(segment);
                return new Path(newSegments, this._allowsChild);
            }
            index -= 1;
        } while(index >= -1);
        // allow -1 as well so we check if the segment is allowed as root
        return null;
    }

    until(type) {
        const index = this._segments.findIndex(s => s.type === type);
        if (index !== -1) {
            return new Path(this._segments.slice(0, index + 1), this._allowsChild)
        }
        return new Path([], this._allowsChild);
    }

    get(type) {
        return this._segments.find(s => s.type === type);
    }

    get segments() {
        return this._segments;
    }
}
