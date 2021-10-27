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

import {ViewModel} from "./ViewModel.js";

export class AccountSetupViewModel extends ViewModel {
    constructor(accountSetup) {
        super();
        this._accountSetup = accountSetup;
        this._dehydratedDevice = undefined;
    }

    get canDehydrateDevice() {
        return !!this._accountSetup.encryptedDehydratedDevice;
    }

    get deviceDecrypted() {
        return !!this._dehydratedDevice;
    }

    get dehydratedDeviceId() {
        return this._accountSetup.encryptedDehydratedDevice.deviceId;
    }

    tryDecryptDehydratedDevice(password) {
        const {encryptedDehydratedDevice} = this._accountSetup;
        if (encryptedDehydratedDevice) {
            this._dehydratedDevice = encryptedDehydratedDevice.decrypt(password);
            this.emitChange("deviceDecrypted");
        }
    }

    finish() {
        this._accountSetup.finish(this._dehydratedDevice);
    }
}
