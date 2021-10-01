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

export class SessionBackupViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._session = options.session;
        this._showKeySetup = true;
        this._error = null;
        this._isBusy = false;
        this.track(this._session.hasSecretStorageKey.subscribe(() => {
            this.emitChange("status");
        }));
    }
    
    get isBusy() {
        return this._isBusy;
    }

    get backupVersion() {
        return this._session.sessionBackup?.version;
    }

    get status() {
        if (this._session.sessionBackup) {
            return "enabled";
        } else {
            if (this._session.hasSecretStorageKey.get() === false) {
                return this._showKeySetup ? "setupKey" : "setupPhrase";
            } else {
                return "pending";
            }
        }
    }

    get error() {
        return this._error?.message;
    }

    showPhraseSetup() {
        this._showKeySetup = false;
        this.emitChange("status");
    }

    showKeySetup() {
        this._showKeySetup = true;
        this.emitChange("status");
    }

    async enterSecurityPhrase(passphrase) {
        if (passphrase) {
            try {
                this._isBusy = true;
                this.emitChange("isBusy");
                await this._session.enableSecretStorage("phrase", passphrase);
            } catch (err) {
                console.error(err);
                this._error = err;
                this.emitChange("error");
            } finally {
                this._isBusy = false;
                this.emitChange("");
            }
        }
    }

    async enterSecurityKey(securityKey) {
        if (securityKey) {
            try {
                this._isBusy = true;
                this.emitChange("isBusy");
                await this._session.enableSecretStorage("key", securityKey);
            } catch (err) {
                console.error(err);
                this._error = err;
                this.emitChange("error");
            } finally {
                this._isBusy = false;
                this.emitChange("");
            }
        }
    }
}
