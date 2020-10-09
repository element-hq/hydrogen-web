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
    constructor(history, navigation) {
        this._subscription = null;
        this._history = history;
        this._navigation = navigation;
    }

    attach() {
        this._subscription = this._history.subscribe(url => {
            this.applyUrl(url);
        });
        this.applyUrl(this._history.get());
    }

    applyUrl(url) {    
        const segments = this._segmentsFromUrl(url);
        const path = this._navigation.pathFrom(segments);
        this._navigation.applyPath(path);
    }

    stop() {
        this._subscription = this._subscription();
    }

    _segmentsFromUrl(url) {
        const path = this._history.urlAsPath(url);
        const parts = path.split("/").filter(p => !!p);
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

    get history() {
        return this._history;
    }

    urlForSegment(type, value) {
        const path = this._navigation.path.with(new Segment(type, value));
        if (path) {
            return this.urlForPath(path);
        }
    }

    urlForPath(path) {
        let urlPath = "";
        for (const {type, value} of path.segments) {
            if (typeof value === "boolean") {
                urlPath += `/${type}`;
            } else {
                urlPath += `/${type}/${value}`;
            }
        }
        return this._history.pathAsUrl(urlPath);
    }
}
