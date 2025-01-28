/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseObservableValue} from "../../../observable/value";

export class History extends BaseObservableValue {
    
    constructor() {
        super();
        this._lastSessionHash = undefined;
    }
    
    handleEvent(event) {
        if (event.type === "hashchange") {
            this.emit(this.get());
            this._storeHash(this.get());
        }
    }

    get() {
        /*
        All URLS in Hydrogen will use <root>/#/segment/value/...
        But for SSO, we need to handle <root>/?loginToken=<TOKEN>
        Handle that as a special case for now.
        */
        if (document.location.search.includes("loginToken")) {
            return document.location.search;
        }
        return document.location.hash;
    }

    /** does not emit */
    replaceUrlSilently(url) {
        window.history.replaceState(null, null, url);
        this._storeHash(url);
    }

    /** does not emit */
    pushUrlSilently(url) {
        window.history.pushState(null, null, url);
        this._storeHash(url);
    }

    pushUrl(url) {
        document.location.hash = url;
    }

    urlAsPath(url) {
        if (url.startsWith("#")) {
            return url.substr(1);
        } else {
            return url;
        }
    }

    pathAsUrl(path) {
        return `#${path}`;
    }

    onSubscribeFirst() {
        this._lastSessionHash = window.localStorage?.getItem("hydrogen_last_url_hash");
        window.addEventListener('hashchange', this);
    }

    onUnsubscribeLast() {
        window.removeEventListener('hashchange', this);
    }

    _storeHash(hash) {
        window.localStorage?.setItem("hydrogen_last_url_hash", hash);
    }

    getLastSessionUrl() {
        return this._lastSessionHash;
    }
}
