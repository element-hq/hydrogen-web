/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {ViewModel} from "./ViewModel";
import {KeyType} from "../matrix/ssss/index";
import {Status} from "./session/settings/KeyBackupViewModel";

export class AccountSetupViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._accountSetup = options.accountSetup;
        this._dehydratedDevice = undefined;
        this._decryptDehydratedDeviceViewModel = undefined;
        if (this._accountSetup.encryptedDehydratedDevice) {
            this._decryptDehydratedDeviceViewModel = new DecryptDehydratedDeviceViewModel(this, dehydratedDevice => {
                this._dehydratedDevice = dehydratedDevice;
                this._decryptDehydratedDeviceViewModel = undefined;
                this.emitChange("deviceDecrypted");
            });
        }
    }

    get decryptDehydratedDeviceViewModel() {
        return this._decryptDehydratedDeviceViewModel;
    }

    get deviceDecrypted() {
        return !!this._dehydratedDevice;
    }

    get dehydratedDeviceId() {
        return this._accountSetup.encryptedDehydratedDevice.deviceId;
    }

    finish() {
        this._accountSetup.finish(this._dehydratedDevice);
    }
}

// this vm adopts the same shape as KeyBackupViewModel so the same view can be reused.
class DecryptDehydratedDeviceViewModel extends ViewModel {
    constructor(accountSetupViewModel, decryptedCallback) {
        super(accountSetupViewModel.options);
        this._accountSetupViewModel = accountSetupViewModel;
        this._isBusy = false;
        this._status = Status.SetupWithRecoveryKey;
        this._error = undefined;
        this._decryptedCallback = decryptedCallback;
    }

    get decryptAction() {
        return this.i18n`Restore`;
    }

    get purpose() {
        return this.i18n`claim your dehydrated device`;
    }

    get offerDehydratedDeviceSetup() {
        return false;
    }

    get dehydratedDeviceId() {
        return this._accountSetupViewModel._dehydratedDevice?.deviceId;
    }
    
    get isBusy() {
        return this._isBusy;
    }

    get backupVersion() { return 0; }

    get status() {
        return this._status;
    }

    get error() {
        return this._error?.message;
    }

    showPhraseSetup() {
        if (this._status === Status.SetupWithRecoveryKey) {
            this._status = Status.SetupWithPassphrase;
            this.emitChange("status");
        }
    }

    showKeySetup() {
        if (this._status === Status.SetupWithPassphrase) {
            this._status = Status.SetupWithRecoveryKey;
            this.emitChange("status");
        }
    }

    async _enterCredentials(keyType, credential) {
        if (credential) {
            try {
                this._isBusy = true;
                this.emitChange("isBusy");
                const {encryptedDehydratedDevice} = this._accountSetupViewModel._accountSetup;
                const dehydratedDevice = await encryptedDehydratedDevice.decrypt(keyType, credential);
                this._decryptedCallback(dehydratedDevice);
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

    enterSecurityPhrase(passphrase) {
        this._enterCredentials(KeyType.Passphrase, passphrase);
    }

    enterSecurityKey(securityKey) {
        this._enterCredentials(KeyType.RecoveryKey, securityKey);
    }

    disable() {}
}
