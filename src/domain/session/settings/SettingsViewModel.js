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

import {ViewModel} from "../../ViewModel.js";
import {SessionBackupViewModel} from "./SessionBackupViewModel.js";

function formatKey(key) {
    const partLength = 4;
    const partCount = Math.ceil(key.length / partLength);
    let formattedKey = "";
    for (let i = 0; i < partCount; i += 1) {
        formattedKey += (formattedKey.length ? " " : "") + key.slice(i * partLength, (i + 1) * partLength);
    }
    return formattedKey;
}

export class SettingsViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._updateService = options.updateService;
        const session = options.session;
        this._session = session;
        this._sessionBackupViewModel = this.track(new SessionBackupViewModel(this.childOptions({session})));
        this._closeUrl = this.urlCreator.urlUntilSegment("session");
    }

    get closeUrl() {
        return this._closeUrl;
    }

    get fingerprintKey() {
        return formatKey(this._session.fingerprintKey);
    }

    get deviceId() {
        return this._session.deviceId;
    }

    get userId() {
        return this._session.userId;
    }

    get version() {
        if (this._updateService) {
            return `${this._updateService.version} (${this._updateService.buildHash})`;
        }
        return this.i18n`development version`;
    }

    checkForUpdate() {
        this._updateService?.checkForUpdate();
    }

    get showUpdateButton() {
        return !!this._updateService;
    }

    get sessionBackupViewModel() {
        return this._sessionBackupViewModel;
    }
}
