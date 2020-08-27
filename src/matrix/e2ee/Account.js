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

import anotherjson from "../../../lib/another-json/index.js";

const ACCOUNT_SESSION_KEY = "olmAccount";
const DEVICE_KEY_FLAG_SESSION_KEY = "areDeviceKeysUploaded";

export class Account {
    static async load({olm, pickleKey, hsApi, userId, deviceId, txn}) {
        const pickledAccount = await txn.session.get(ACCOUNT_SESSION_KEY);
        if (pickledAccount) {
            const account = new olm.Account();
            const areDeviceKeysUploaded = await txn.session.get(DEVICE_KEY_FLAG_SESSION_KEY);
            account.unpickle(pickleKey, pickledAccount);
            return new Account({pickleKey, hsApi, account, userId, deviceId, areDeviceKeysUploaded});
        }
    }

    static async create({olm, pickleKey, hsApi, userId, deviceId, txn}) {
        const account = new olm.Account();
        account.create();
        account.generate_one_time_keys(account.max_number_of_one_time_keys());
        const pickledAccount = account.pickle(pickleKey);
        // add will throw if the key already exists
        // we would not want to overwrite olmAccount here
        const areDeviceKeysUploaded = false;
        await txn.session.add(ACCOUNT_SESSION_KEY, pickledAccount);
        await txn.session.add(DEVICE_KEY_FLAG_SESSION_KEY, areDeviceKeysUploaded);
        return new Account({pickleKey, hsApi, account, userId, deviceId, areDeviceKeysUploaded});
    }

    constructor({pickleKey, hsApi, account, userId, deviceId, areDeviceKeysUploaded}) {
        this._pickleKey = pickleKey;
        this._hsApi = hsApi;
        this._account = account;
        this._userId = userId;
        this._deviceId = deviceId;
        this._areDeviceKeysUploaded = areDeviceKeysUploaded;
    }
}
