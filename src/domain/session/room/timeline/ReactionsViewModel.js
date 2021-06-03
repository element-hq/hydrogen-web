/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import {ViewModel} from "../../../ViewModel.js";
import {ObservableMap} from "../../../../observable/map/ObservableMap.js";

export class ReactionsViewModel {
    constructor(parentEntry) {
        this._parentEntry = parentEntry;
        this._map = new ObservableMap();
        this._reactions = this._map.sortValues((a, b) => a._compare(b));
    }

    update(annotations) {
        for (const key in annotations) {
            if (annotations.hasOwnProperty(key)) {
                const annotation = annotations[key];
                const reaction = this._map.get(key);
                if (reaction) {
                    if (reaction._tryUpdate(annotation)) {
                        this._map.update(key);
                    }
                } else {
                    this._map.add(key, new ReactionViewModel(key, annotation, this._parentEntry));
                }
            }
        }
        for (const existingKey of this._map.keys()) {
            if (!annotations.hasOwnProperty(existingKey)) {
                this._map.remove(existingKey);
            }
        }
    }

    get reactions() {
        return this._reactions;
    }
}

class ReactionViewModel {
    constructor(key, annotation, parentEntry) {
        this._key = key;
        this._annotation = annotation;
        this._parentEntry = parentEntry;
    }

    _tryUpdate(annotation) {
        if (
            annotation.me !== this._annotation.me ||
            annotation.count !== this._annotation.count ||
            annotation.firstTimestamp !== this._annotation.firstTimestamp
        ) {
            this._annotation = annotation;
            return true;
        }
        return false;
    }

    get key() {
        return this._key;
    }

    get count() {
        return this._annotation.count;
    }

    get haveReacted() {
        return this._annotation.me;
    }

    _compare(other) {
        const a = this._annotation;
        const b = other._annotation;
        if (a.count !== b.count) {
            return b.count - a.count;
        } else {
            return a.firstTimestamp - b.firstTimestamp;
        }
    }

    toggleReaction() {
        if (this.haveReacted) {
            return this._parentEntry.redactReaction(this.key);
        } else {
            return this._parentEntry.react(this.key);
        }
    }
}