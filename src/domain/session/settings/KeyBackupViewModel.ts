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

import {ViewModel} from "../../ViewModel";
import {SegmentType} from "../../navigation/index";
import {KeyType} from "../../../matrix/ssss/index";

import type {Options as BaseOptions} from "../../ViewModel";
import type {Session} from "../../../matrix/Session";
import type {Disposable} from "../../../utils/Disposables";
import type {KeyBackup, Progress} from "../../../matrix/e2ee/megolm/keybackup/KeyBackup";
import type {CrossSigning} from "../../../matrix/verification/CrossSigning";

export enum Status {
    Enabled,
    SetupWithPassphrase,
    SetupWithRecoveryKey,
    Pending,
    NewVersionAvailable
};

export enum BackupWriteStatus {
    Writing,
    Stopped,
    Done,
    Pending
};

type Options = {
    session: Session,
} & BaseOptions;

export class KeyBackupViewModel extends ViewModel<SegmentType, Options> {
    private _error?: Error = undefined;
    private _isBusy = false;
    private _dehydratedDeviceId?: string = undefined;
    private _status = Status.Pending;
    private _backupOperationSubscription?: Disposable = undefined;
    private _keyBackupSubscription?: Disposable = undefined;
    private _progress?: Progress = undefined;
    private _setupKeyType = KeyType.RecoveryKey;

    constructor(options) {
        super(options);
        const onKeyBackupSet = (keyBackup: KeyBackup | undefined) => {
            if (keyBackup && !this._keyBackupSubscription) {
                this._keyBackupSubscription = this.track(this._session.keyBackup.get().disposableOn("change", () => {
                    this._onKeyBackupChange();
                }));
            } else if (!keyBackup && this._keyBackupSubscription) {
                this._keyBackupSubscription = this.disposeTracked(this._keyBackupSubscription);
            }
            this._onKeyBackupChange(); // update status
        };
        this.track(this._session.keyBackup.subscribe(onKeyBackupSet));
        this.track(this._session.crossSigning.subscribe(() => {
            this.emitChange("crossSigning");
        }));
        onKeyBackupSet(this._keyBackup);
    }

    private get _session(): Session {
        return this.getOption("session");
    }

    private get _keyBackup(): KeyBackup | undefined {
        return this._session.keyBackup.get();
    }

    private get _crossSigning(): CrossSigning | undefined {
        return this._session.crossSigning.get();
    }

    private _onKeyBackupChange() {
        const keyBackup = this._keyBackup;
        if (keyBackup) {
            const {operationInProgress} = keyBackup;
            if (operationInProgress && !this._backupOperationSubscription) {
                this._backupOperationSubscription = this.track(operationInProgress.disposableOn("change", () => {
                    this._progress = operationInProgress.progress;
                    this.emitChange("backupPercentage");
                }));
            } else if (this._backupOperationSubscription && !operationInProgress) {
                this._backupOperationSubscription = this.disposeTracked(this._backupOperationSubscription);
                this._progress = undefined;
            }
        }
        this.emitChange("status");
    }

    get status(): Status {
        const keyBackup = this._keyBackup;
        if (keyBackup) {
            if (keyBackup.needsNewKey) {
                return Status.NewVersionAvailable;
            } else if (keyBackup.version === undefined) {
                return Status.Pending;
            } else {
                return keyBackup.needsNewKey ? Status.NewVersionAvailable : Status.Enabled;
            }
        } else {
            switch (this._setupKeyType) {
                case KeyType.RecoveryKey: return Status.SetupWithRecoveryKey;
                case KeyType.Passphrase: return Status.SetupWithPassphrase;
            }
        }
    }

    get decryptAction(): string {
        return this.i18n`Set up`;
    }

    get purpose(): string {
        return this.i18n`set up key backup`;
    }

    offerDehydratedDeviceSetup(): boolean {
        return true;
    }

    get dehydratedDeviceId(): string | undefined {
        return this._dehydratedDeviceId;
    }
    
    get isBusy(): boolean {
        return this._isBusy;
    }

    get backupVersion(): string {
        return this._keyBackup?.version ?? "";
    }

    get isMasterKeyTrusted(): boolean {
        return this._crossSigning?.isMasterKeyTrusted ?? false;
    }

    get canSignOwnDevice(): boolean {
        return !!this._crossSigning;
    }

    private async _signOwnDevice(): Promise<void> {
        const crossSigning = this._crossSigning;
        if (crossSigning) {
            await this.logger.run("KeyBackupViewModel.signOwnDevice", async log => {
                await crossSigning.signOwnDevice(log);
            });
        }
    }

    navigateToVerification(): void {
        this.navigation.push("device-verification", true);
    }

    get backupWriteStatus(): BackupWriteStatus {
        const keyBackup = this._keyBackup;
        if (!keyBackup || keyBackup.version === undefined) {
            return BackupWriteStatus.Pending;
        } else if (keyBackup.hasStopped) {
            return BackupWriteStatus.Stopped;
        }
        const operation = keyBackup.operationInProgress;
        if (operation) {
            return BackupWriteStatus.Writing;
        } else if (keyBackup.hasBackedUpAllKeys) {
            return BackupWriteStatus.Done;
        } else {
            return BackupWriteStatus.Pending;
        }
    }

    get backupError(): string | undefined {
        return this._keyBackup?.error?.message;
    }

    get error(): string | undefined {
        return this._error?.message;
    }

    showPhraseSetup(): void {
        this._setupKeyType = KeyType.Passphrase;
        this.emitChange("status");
    }

    showKeySetup(): void {
        this._setupKeyType = KeyType.RecoveryKey;
        this.emitChange("status");
    }

    private async _enterCredentials(keyType, credential, setupDehydratedDevice): Promise<void> {
        if (credential) {
            try {
                this._isBusy = true;
                this.emitChange("isBusy");
                const key = await this._session.enableSecretStorage(keyType, credential);
                if (setupDehydratedDevice) {
                    this._dehydratedDeviceId = await this._session.setupDehydratedDevice(key);
                }
                await this._signOwnDevice();
            } catch (err) {
                console.error(err);
                this._error = err;
                this.emitChange("error");
            } finally {
                this._isBusy = false;
                this.emitChange();
            }
        }
    }

    enterSecurityPhrase(passphrase, setupDehydratedDevice): Promise<void> {
        return this._enterCredentials(KeyType.Passphrase, passphrase, setupDehydratedDevice);
    }

    enterSecurityKey(securityKey, setupDehydratedDevice): Promise<void> {
        return this._enterCredentials(KeyType.RecoveryKey, securityKey, setupDehydratedDevice);
    }

    async disable(): Promise<void> {
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
            this.emitChange();
        }
    }

    get isBackingUp(): boolean {
        return this._keyBackup?.operationInProgress !== undefined;
    }

    get backupPercentage(): number {
        if (this._progress) {
            return Math.round((this._progress.finished / this._progress.total) * 100);
        }
        return 0;
    }

    get backupInProgressLabel(): string {
        if (this._progress) {
            return this.i18n`${this._progress.finished} of ${this._progress.total}`;
        }
        return this.i18n`…`;
    }

    cancelBackup(): void {
        this._keyBackup?.operationInProgress?.abort();
    }

    startBackup(): void {
        this.logger.run("KeyBackupViewModel.startBackup", log => {
            this._keyBackup?.flush(log);
        });
    }
}

