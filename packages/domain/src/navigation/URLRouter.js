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

export class URLRouter {
    constructor({history, navigation, parseUrlPath, stringifyPath}) {
        this._history = history;
        this._navigation = navigation;
        this._parseUrlPath = parseUrlPath;
        this._stringifyPath = stringifyPath;
        this._subscription = null;
        this._pathSubscription = null;
        this._isApplyingUrl = false;
        this._defaultSessionId = this._getLastSessionId();
    }

    _getLastSessionId() {
        const navPath = this._urlAsNavPath(this._history.getLastUrl() || "");
        const sessionId = navPath.get("session")?.value;
        if (typeof sessionId === "string") {
            return sessionId;
        }
        return null;
    }

    attach() {
        this._subscription = this._history.subscribe(url => this._applyUrl(url));
        // subscribe to path before applying initial url
        // so redirects in _applyNavPathToHistory are reflected in url bar
        this._pathSubscription = this._navigation.pathObservable.subscribe(path => this._applyNavPathToHistory(path));
        this._applyUrl(this._history.get());
    }

    dispose() {
        this._subscription = this._subscription();
        this._pathSubscription = this._pathSubscription();
    }

    _applyNavPathToHistory(path) {
        const url = this.urlForPath(path);
        if (url !== this._history.get()) {
            if (this._isApplyingUrl) {
                // redirect
                this._history.replaceUrlSilently(url);
            } else {
                this._history.pushUrlSilently(url);
            }
        }
    }

    _applyNavPathToNavigation(navPath) {
        // this will cause _applyNavPathToHistory to be called,
        // so set a flag whether this request came from ourselves
        // (in which case it is a redirect if the url does not match the current one)
        this._isApplyingUrl = true;
        this._navigation.applyPath(navPath);
        this._isApplyingUrl = false;
    }

    _urlAsNavPath(url) {
        const urlPath = this._history.urlAsPath(url);
        return this._navigation.pathFrom(this._parseUrlPath(urlPath, this._navigation.path, this._defaultSessionId));
    }

    _applyUrl(url) {
        const navPath = this._urlAsNavPath(url);
        this._applyNavPathToNavigation(navPath);
    }

    pushUrl(url) {
        this._history.pushUrl(url);
    }

    tryRestoreLastUrl() {
        const lastNavPath = this._urlAsNavPath(this._history.getLastUrl() || "");
        if (lastNavPath.segments.length !== 0) {
            this._applyNavPathToNavigation(lastNavPath);
            return true;
        }
        return false;
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

    urlUntilSegment(type) {
        return this.urlForPath(this._navigation.path.until(type));
    }

    urlForPath(path) {
        return this._history.pathAsUrl(this._stringifyPath(path));
    }

    openRoomActionUrl(roomId) {
        // not a segment to navigation knowns about, so append it manually
        const urlPath = `${this._stringifyPath(this._navigation.path.until("session"))}/open-room/${roomId}`;
        return this._history.pathAsUrl(urlPath);
    }

    createSSOCallbackURL() {
        return window.location.origin;
    }

    normalizeUrl() {
        // Remove any queryParameters from the URL
        // Gets rid of the loginToken after SSO
        this._history.replaceUrlSilently(`${window.location.origin}/${window.location.hash}`);
    }
}
