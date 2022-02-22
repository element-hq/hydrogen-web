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

import type {History} from "../../platform/web/dom/History.js";
import type {Navigation, Segment, Path, OptionalValue} from "./Navigation";
import type {SubscriptionHandle} from "../../observable/BaseObservable";
import type {SegmentType} from "./index";

type ParseURLPath<T> = (urlPath: string, currentNavPath: Path<T>, defaultSessionId?: string) => Segment<T>[];
type StringifyPath<T> = (path: Path<T>) => string;

export class URLRouter<T extends SegmentType> {
    private readonly _history: History;
    private readonly _navigation: Navigation<T>;
    private readonly _parseUrlPath: ParseURLPath<T>;
    private readonly _stringifyPath: StringifyPath<T>;
    private _subscription?: SubscriptionHandle;
    private _pathSubscription?: SubscriptionHandle;
    private _isApplyingUrl: boolean = false;
    private _defaultSessionId?: string;

    constructor(history: History, navigation: Navigation<T>, parseUrlPath: ParseURLPath<T>, stringifyPath: StringifyPath<T>) {
        this._history = history;
        this._navigation = navigation;
        this._parseUrlPath = parseUrlPath;
        this._stringifyPath = stringifyPath;
        this._defaultSessionId = this._getLastSessionId();
    }

    private _getLastSessionId(): string | undefined {
        const navPath = this._urlAsNavPath(this._history.getLastUrl() || "");
        const sessionId = navPath.get("session")?.value;
        if (typeof sessionId === "string") {
            return sessionId;
        }
        return undefined;
    }

    attach(): void {
        this._subscription = this._history.subscribe(url => this._applyUrl(url));
        // subscribe to path before applying initial url
        // so redirects in _applyNavPathToHistory are reflected in url bar
        this._pathSubscription = this._navigation.pathObservable.subscribe(path => this._applyNavPathToHistory(path));
        this._applyUrl(this._history.get());
    }

    dispose(): void {
        if (this._subscription) { this._subscription = this._subscription(); }
        if (this._pathSubscription) { this._pathSubscription = this._pathSubscription(); }
    }

    private _applyNavPathToHistory(path: Path<T>): void {
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

    private _applyNavPathToNavigation(navPath: Path<T>): void {
        // this will cause _applyNavPathToHistory to be called,
        // so set a flag whether this request came from ourselves
        // (in which case it is a redirect if the url does not match the current one)
        this._isApplyingUrl = true;
        this._navigation.applyPath(navPath);
        this._isApplyingUrl = false;
    }

    private _urlAsNavPath(url: string): Path<T> {
        const urlPath = this._history.urlAsPath(url);
        return this._navigation.pathFrom(this._parseUrlPath(urlPath, this._navigation.path, this._defaultSessionId));
    }

    private _applyUrl(url: string): void {
        const navPath = this._urlAsNavPath(url);
        this._applyNavPathToNavigation(navPath);
    }

    pushUrl(url: string): void {
        this._history.pushUrl(url);
    }

    tryRestoreLastUrl(): boolean {
        const lastNavPath = this._urlAsNavPath(this._history.getLastUrl() || "");
        if (lastNavPath.segments.length !== 0) {
            this._applyNavPathToNavigation(lastNavPath);
            return true;
        }
        return false;
    }

    urlForSegments(segments: Segment<T>[]): string | undefined {
        let path: Path<T> | null = this._navigation.path;
        for (const segment of segments) {
            path = path.with(segment);
            if (!path) {
                return;
            }
        }
        return this.urlForPath(path);
    }

    urlForSegment<K extends keyof T>(type: K, ...value: OptionalValue<T[K]>): string | undefined {
        return this.urlForSegments([this._navigation.segment(type, ...value)]);
    }

    urlUntilSegment(type: keyof T): string {
        return this.urlForPath(this._navigation.path.until(type));
    }

    urlForPath(path: Path<T>): string {
        return this._history.pathAsUrl(this._stringifyPath(path));
    }

    openRoomActionUrl(roomId: string) {
        // not a segment to navigation knowns about, so append it manually
        const urlPath = `${this._stringifyPath(this._navigation.path.until("session"))}/open-room/${roomId}`;
        return this._history.pathAsUrl(urlPath);
    }

    createSSOCallbackURL(): string {
        return window.location.origin;
    }

    normalizeUrl(): void {
        // Remove any queryParameters from the URL
        // Gets rid of the loginToken after SSO
        this._history.replaceUrlSilently(`${window.location.origin}/${window.location.hash}`);
    }
}
