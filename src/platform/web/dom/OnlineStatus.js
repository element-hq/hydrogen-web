/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
