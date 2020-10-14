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

import {BaseObservableValue} from "../../../observable/ObservableValue.js";

export class History extends BaseObservableValue {
    constructor() {
        super();
        this._boundOnHashChange = null;
        this._expectSetEcho = false;
    }

    _onHashChange() {
        if (this._expectSetEcho) {
            this._expectSetEcho = false;
            return;
        }
        this.emit(this.get());
    }

    get() {
        return document.location.hash;
    }

    /** does not emit */
    replaceUrl(url) {
        window.history.replaceState(null, null, url);
    }

    /** does not emit */
    pushUrl(url) {
        window.history.pushState(null, null, url);
        // const hash = this.urlAsPath(url);
        // // important to check before we expect an echo
        // // as setting the hash to it's current value doesn't
        // // trigger onhashchange
        // if (hash === document.location.hash) {
        //     return;
        // }
        // // this operation is silent, 
        // // so avoid emitting on echo hashchange event
        // if (this._boundOnHashChange) {
        //     this._expectSetEcho = true;
        // }
        // document.location.hash = hash;
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
        this._boundOnHashChange = this._onHashChange.bind(this);
        window.addEventListener('hashchange', this._boundOnHashChange);
    }

    onUnsubscribeLast() {
        window.removeEventListener('hashchange', this._boundOnHashChange);
        this._boundOnHashChange = null;
    }
}
