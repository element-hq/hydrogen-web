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
import {KeyType} from "../../../matrix/ssss/index.js";
import {createEnum} from "../../../utils/enum.js";

export const Status = createEnum("Enabled", "SetupKey", "SetupPhrase", "Pending"); 

export class SessionBackupViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._session = options.session;
        this._error = null;
        this._isBusy = false;
        this._dehydratedDeviceId = undefined;
        this._status = undefined;
        this._reevaluateStatus();
        this.track(this._session.hasSecretStorageKey.subscribe(() => {
            if (this._reevaluateStatus()) {
                this.emitChange("status");
            }
        }));
    }

    _reevaluateStatus() {
        if (this._isBusy) {
            return false;
        }
        let status;
        const hasSecretStorageKey = this._session.hasSecretStorageKey.get();
        if (hasSecretStorageKey === true) {
            status = this._session.sessionBackup ? Status.Enabled : Status.SetupKey;
        } else if (hasSecretStorageKey === false) {
            status = Status.SetupKey;
        } else {
            status = Status.Pending;
        }
        const changed = status !== this._status;
        this._status = status;
        return changed;
    }

    get decryptAction() {
        return this.i18n`Set up`;
    }

    get purpose() {
        return this.i18n`set up session backup`;
    }

    offerDehydratedDeviceSetup() {
        return true;
    }

    get dehydratedDeviceId() {
        return this._dehydratedDeviceId;
    }
    
    get isBusy() {
        return this._isBusy;
    }

    get backupVersion() {
        return this._session.sessionBackup?.version;
    }

    get status() {
        return this._status;
    }

    get error() {
        return this._error?.message;
    }

    showPhraseSetup() {
        if (this._status === Status.SetupKey) {
            this._status = Status.SetupPhrase;
            this.emitChange("status");
        }
    }

    showKeySetup() {
        if (this._status === Status.SetupPhrase) {
            this._status = Status.SetupKey;
            this.emitChange("status");
        }
    }

    async _enterCredentials(keyType, credential, setupDehydratedDevice) {
        if (credential) {
            try {
                this._isBusy = true;
                this.emitChange("isBusy");
                const key = await this._session.enableSecretStorage(keyType, credential);
                if (setupDehydratedDevice) {
                    this._dehydratedDeviceId = await this._session.setupDehydratedDevice(key);
                }
            } catch (err) {
                console.error(err);
                this._error = err;
                this.emitChange("error");
            } finally {
                this._isBusy = false;
                this._reevaluateStatus();
                this.emitChange("");
            }
        }
    }

    enterSecurityPhrase(passphrase, setupDehydratedDevice) {
        this._enterCredentials(KeyType.Passphrase, passphrase, setupDehydratedDevice);
    }

    enterSecurityKey(securityKey, setupDehydratedDevice) {
        this._enterCredentials(KeyType.RecoveryKey, securityKey, setupDehydratedDevice);
    }

    async disable() {
        try {
            this._isBusy = true;
            this.emitChange("isBusy");
            await this._session.disableSecretStorage();
        } catch (err) {
            console.error(err);
            this._error = err;
            this.emitChange("error");
        } finally {
            this._isBusy = false;
            this._reevaluateStatus();
            this.emitChange("");
        }
    }
}
