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

import {BaseObservableValue} from "../../../observable/value";

export class OnlineStatus extends BaseObservableValue {
    constructor() {
        super();
        this._onOffline = this._onOffline.bind(this);
        this._onOnline = this._onOnline.bind(this);
    }

    _onOffline() {
        this.emit(false);
    }

    _onOnline() {
        this.emit(true);
    }

    get() {
        return navigator.onLine;
    }

    onSubscribeFirst() {
        window.addEventListener('offline', this._onOffline);
        window.addEventListener('online', this._onOnline);
    }

    onUnsubscribeLast() {
        window.removeEventListener('offline', this._onOffline);
        window.removeEventListener('online', this._onOnline);
    }
}
