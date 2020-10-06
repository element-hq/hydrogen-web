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

import {Segment} from "./Navigation.js";

export class URLRouter {
    constructor(pathObservable, navigation) {
        this._subscription = null;
        this._pathObservable = pathObservable;
        this._navigation = navigation;
    }

    start() {
        this._subscription = this._pathObservable.subscribe(url => {
            const segments = this._segmentsFromUrl(url);
            const path = this._navigation.pathFrom(segments);
            this._navigation.applyPath(path);
        });
    }

    stop() {
        this._subscription = this._subscription();
    }

    _segmentsFromUrl(path) {
        const parts = path.split("/");
        let index = 0;
        const segments = [];
        while (index < parts.length) {
            const type = parts[index];
            if ((index + 1) < parts.length) {
                index += 1;
                const value = parts[index];
                segments.push(new Segment(type, value));
            } else {
                segments.push(new Segment(type));
            }
            index += 1;
        }
        return segments;
    }

    urlForSegment(type, value) {
        const path = this._navigation.path.with(new Segment(type, value));
        if (path) {
            return this.urlForPath(path);
        }
    }

    urlForPath(path) {
        let url = "#";
        for (const {type, value} of path.segments) {
            if (typeof value === "boolean") {
                url += `/${type}`;
            } else {
                url += `/${type}/${value}`;
            }
        }
        return url;
    }
}
