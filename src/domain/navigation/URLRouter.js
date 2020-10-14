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
    constructor({history, navigation, parseUrlPath, stringifyPath}) {
        this._subscription = null;
        this._history = history;
        this._navigation = navigation;
        this._parseUrlPath = parseUrlPath;
        this._stringifyPath = stringifyPath;
    }

    attach() {
        this._subscription = this._history.subscribe(url => {
            const redirectedUrl = this.applyUrl(url);
            if (redirectedUrl !== url) {
                this._history.replaceUrl(redirectedUrl);
            }
        });
        this.applyUrl(this._history.get());
    }

    dispose() {
        this._subscription = this._subscription();
    }

    applyUrl(url) {    
        const urlPath = this._history.urlAsPath(url)
        const navPath = this._navigation.pathFrom(this._parseUrlPath(urlPath, this._navigation.path));
        this._navigation.applyPath(navPath);
        return this._history.pathAsUrl(this._stringifyPath(navPath));
    }

    get history() {
        return this._history;
    }

    urlForSegments(segments) {
        let path = this._navigation.path;
        for (const segment of segments) {
            path = path.with(segment);
            if (!path) {
                return;
            }
        }
        return this.urlForPath(path);
    }

    urlForSegment(type, value) {
        return this.urlForSegments([this._navigation.segment(type, value)]);
    }

    urlForPath(path) {
        return this.history.pathAsUrl(this._stringifyPath(path));
    }

    openRoomActionUrl(roomId) {
        // not a segment to navigation knowns about, so append it manually
        const urlPath = `${this._stringifyPath(this._navigation.path.until("session"))}/open-room/${roomId}`;
        return this._history.pathAsUrl(urlPath);
    }

    disableGridUrl() {
        let path = this._navigation.path.until("session");
        const room = this._navigation.path.get("room");
        if (room) {
            path = path.with(room);
        }
        return this.urlForPath(path);
    }

    enableGridUrl() {
        let path = this._navigation.path.until("session");
        const room = this._navigation.path.get("room");
        if (room) {
            path = path.with(this._navigation.segment("rooms", [room.value]));
            path = path.with(room);
        } else {
            path = path.with(this._navigation.segment("rooms", []));
            path = path.with(this._navigation.segment("empty-grid-tile", 0));
        }
        return this.urlForPath(path);
    }
}
