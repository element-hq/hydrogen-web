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

export const DEHYDRATION_LIBOLM_PICKLE_ALGORITHM = "org.matrix.msc2697.v1.olm.libolm_pickle"; 

async function getDehydratedDevice(hsApi, olm) {
    const response = await hsApi.getDehydratedDevice().response();
    if (response.device_data.algorithm === DEHYDRATION_LIBOLM_PICKLE_ALGORITHM) {
        return new DehydratedDevice(response, olm);
    }
}

async function hasRemainingDevice(ownUserId, ownDeviceId, storage) {

}

async function uploadAccountAsDehydratedDevice(account, hsApi, key, deviceDisplayName, log) {
    const response = await hsApi.createDehydratedDevice({
        device_data: {
            algorithm: DEHYDRATION_LIBOLM_PICKLE_ALGORITHM,
            account: account.pickleWithKey(new Uint8Array(key)),
            passphrase: {}
        },
        initial_device_display_name: deviceDisplayName
    }).response();
    const deviceId = response.device_id;
    await account.uploadKeys(undefined, deviceId, log);
    return deviceId;
}

class EncryptedDehydratedDevice {
    constructor(dehydratedDevice, olm) {
        this._dehydratedDevice = dehydratedDevice;
        this._olm = olm;
    }

    decrypt(key) {
        const account = new this._olm.Account();
        try {
            const pickledAccount = this._dehydratedDevice.device_data.account;
            account.unpickle(key, pickledAccount);
            return new DehydratedDevice(this._dehydratedDevice, account);
        } catch (err) {
            account.free();
            return null;
        }
    }
}

class DehydratedDevice {
    constructor(dehydratedDevice, account) {
        this._dehydratedDevice = dehydratedDevice;
        this._account = account;
    }

    claim(hsApi, log) {
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
        this._account = null;
        return account;
    }

    get deviceId() {
        this._dehydratedDevice.device_id;
    }
}
