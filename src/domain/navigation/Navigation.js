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
        this._path = path;
        for (const [type, observable] of this._observables) {
            // if the value did not change, this won't emit
            observable.set(this._path.get(type)?.value);
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
}

export class Segment {
    constructor(type, value = true) {
        this.type = type;
        this.value = value;
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

    get(type) {
        return this._segments.find(s => s.type === type);
    }

    get segments() {
        return this._segments;
    }
}
