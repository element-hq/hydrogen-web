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

import {BaseObservableValue} from "../../../observable/ObservableValue";

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
