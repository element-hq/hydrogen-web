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
import {KeyType} from "../../../matrix/ssss/index";
import {createEnum} from "../../../utils/enum";

export const Status = createEnum("Enabled", "SetupKey", "SetupPhrase", "Pending", "NewVersionAvailable"); 

export class KeyBackupViewModel extends ViewModel {
    constructor(options) {
        super(options);
        this._session = options.session;
        this._error = null;
        this._isBusy = false;
        this._dehydratedDeviceId = undefined;
        this._status = undefined;
        this._needsNewKeySubscription = undefined;
        this._operationSubscription = undefined;
        this._operationProgressSubscription = undefined;
        this._reevaluateStatus();
        this.track(this._session.keyBackup.subscribe(() => {
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
        const keyBackup = this._session.keyBackup.get();
        if (keyBackup) {
            if (!this._needsNewKeySubscription) {
                this._needsNewKeySubscription = this.track(keyBackup.needsNewKey.subscribe(() => this._reevaluateStatus()));
            }
            if (!this._operationSubscription) {
                this._operationSubscription = this.track(keyBackup.operationInProgress.subscribe(op => {
                    if (op && !this._operationProgressSubscription) {
                        this._operationProgressSubscription = this.track(op.progress.subscribe(() => this.emitChange("backupPercentage")));
                    } else if (!op && this._operationProgressSubscription) {
                        this._operationProgressSubscription = this.disposeTracked(this._operationProgressSubscription);
                    }
                    this.emitChange("isBackingUp");
                }));
            }
            status = keyBackup.needsNewKey.get() ? Status.NewVersionAvailable : Status.Enabled;
        } else {
            this._needsNewKeySubscription = this.disposeTracked(this._needsNewKeySubscription);
            this._operationSubscription = this.disposeTracked(this._operationSubscription);
            this._operationProgressSubscription = this.disposeTracked(this._operationProgressSubscription);
            status = this.showPhraseSetup() ? Status.SetupPhrase : Status.SetupKey;
        } /* TODO: bring back "waiting to get online"
        else {
            status = Status.Pending;
        } */
        const changed = status !== this._status;
        this._status = status;
        return changed;
    }

    get decryptAction() {
        return this.i18n`Set up`;
    }

    get purpose() {
        return this.i18n`set up key backup`;
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
        return this._session.keyBackup.get()?.version;
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

    get isBackingUp() {
        const keyBackup = this._session.keyBackup.get();
        if (keyBackup) {
            return !!keyBackup.operationInProgress.get();
        }
        return undefined;
    }

    get backupPercentage() {
        const keyBackup = this._session.keyBackup.get();
        if (keyBackup) {
            const op = keyBackup.operationInProgress.get();
            const progress = op.progress.get();
            if (progress) {
                return Math.round(progress.finished / progress.total) * 100;
            }
        }
        return 0;
    }

    get backupInProgressLabel() {
        const keyBackup = this._session.keyBackup.get();
        if (keyBackup) {
            const op = keyBackup.operationInProgress.get();
            if (op) {
                const progress = op.progress.get();
                if (progress) {
                    return this.i18n`${progress.finished} of ${progress.total}`;
                } else {
                    return this.i18n`…`;
                }
            }
        }
        return undefined;
    }

    cancelBackup() {
        this._session.keyBackup.get()?.operationInProgress.get()?.abort();
    }
}

