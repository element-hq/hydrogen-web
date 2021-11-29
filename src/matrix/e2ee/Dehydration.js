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

const DEHYDRATION_LIBOLM_PICKLE_ALGORITHM = "org.matrix.msc2697.v1.olm.libolm_pickle"; 
import {KeyDescription} from "../ssss/common";
import {keyFromCredentialAndDescription} from "../ssss/index";

export async function getDehydratedDevice(hsApi, olm, platform, log) {
    try {
        const response = await hsApi.getDehydratedDevice({log}).response();
        if (response.device_data.algorithm === DEHYDRATION_LIBOLM_PICKLE_ALGORITHM) {
            return new EncryptedDehydratedDevice(response, olm, platform);
        }
    } catch (err) {
        if (err.name !== "HomeServerError") {
            log.error = err;
        }
        return undefined;
    }
}

export async function uploadAccountAsDehydratedDevice(account, hsApi, key, deviceDisplayName, log) {
    const response = await hsApi.createDehydratedDevice({
        device_data: {
            algorithm: DEHYDRATION_LIBOLM_PICKLE_ALGORITHM,
            account: account.pickleWithKey(key.binaryKey.slice()),
            passphrase: key.description?.passphraseParams || {},
        },
        initial_device_display_name: deviceDisplayName
    }).response();
    const deviceId = response.device_id;
    account.setDeviceId(deviceId);
    await account.uploadKeys(undefined, true, log);
    return deviceId;
}

class EncryptedDehydratedDevice {
    constructor(dehydratedDevice, olm, platform) {
        this._dehydratedDevice = dehydratedDevice;
        this._olm = olm;
        this._platform = platform;
    }

    async decrypt(keyType, credential) {
        const keyDescription = new KeyDescription("dehydrated_device", this._dehydratedDevice.device_data.passphrase);
        const key = await keyFromCredentialAndDescription(keyType, credential, keyDescription, this._platform, this._olm);
        const account = new this._olm.Account();
        try {
            const pickledAccount = this._dehydratedDevice.device_data.account;
            account.unpickle(key.binaryKey.slice(), pickledAccount);
            return new DehydratedDevice(this._dehydratedDevice, account, key);
        } catch (err) {
            account.free();
            if (err.message === "OLM.BAD_ACCOUNT_KEY") {
                return undefined;
            } else {
                throw err;
            }
        }
    }

    get deviceId() {
        return this._dehydratedDevice.device_id;
    }
}

class DehydratedDevice {
    constructor(dehydratedDevice, account, key) {
        this._dehydratedDevice = dehydratedDevice;
        this._account = account;
        this._key = key;
    }

    async claim(hsApi, log) {
        try {
            const response = await hsApi.claimDehydratedDevice(this.deviceId, {log}).response();
            return response.success;
        } catch (err) {
            return false;
        }
    }

    // make it clear that ownership is transfered upon calling this
    adoptUnpickledOlmAccount() {
        const account = this._account;
        this._account = undefined;
        return account;
    }

    get deviceId() {
        return this._dehydratedDevice.device_id;
    }

    get key() {
        return this._key;
    }

    dispose() {
        this._account?.free();
        this._account = undefined;
    }
}
