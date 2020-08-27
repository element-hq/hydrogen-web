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

    async uploadKeys(storage) {
        const oneTimeKeys = JSON.parse(this._account.one_time_keys());
        // only one algorithm supported by olm atm, so hardcode its name
        const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
        if (oneTimeKeysEntries.length || !this._areDeviceKeysUploaded) {
            const payload = {};
            if (!this._areDeviceKeysUploaded) {
                const identityKeys = JSON.parse(this._account.identity_keys());
                payload.device_keys = this._deviceKeysPayload(identityKeys);
            }
            if (oneTimeKeysEntries.length) {
                payload.one_time_keys = this._oneTimeKeysPayload(oneTimeKeysEntries);
            }
            await this._hsApi.uploadKeys(payload);

            await this._updateSessionStorage(storage, sessionStore => {
                if (oneTimeKeysEntries.length) {
                    this._account.mark_keys_as_published();
                    sessionStore.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
                }
                if (!this._areDeviceKeysUploaded) {
                    this._areDeviceKeysUploaded = true;
                    sessionStore.set(DEVICE_KEY_FLAG_SESSION_KEY, this._areDeviceKeysUploaded);
                }
            });
        }
    }

    _deviceKeysPayload(identityKeys) {
        const obj = {
            user_id: this._userId,
            device_id: this._deviceId,
            algorithms: [
                "m.olm.v1.curve25519-aes-sha2",
                "m.megolm.v1.aes-sha2"
            ],
            keys: {}
        };
        for (const [algorithm, pubKey] of Object.entries(identityKeys)) {
            obj.keys[`${algorithm}:${this._deviceId}`] = pubKey;
        }
        this.signObject(obj);
        return obj;
    }

    _oneTimeKeysPayload(oneTimeKeysEntries) {
        const obj = {};
        for (const [keyId, pubKey] of oneTimeKeysEntries) {
            const keyObj = {
                key: pubKey  
            };
            this.signObject(keyObj);
            obj[`signed_curve25519:${keyId}`] = keyObj;
        }
        return obj;
    }

    async _updateSessionStorage(storage, callback) {
        const txn = await storage.readWriteTxn([
            storage.storeNames.session
        ]);
        try {
            callback(txn.session);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
    }

    signObject(obj) {
        const sigs = obj.signatures || {};
        const unsigned = obj.unsigned;

        delete obj.signatures;
        delete obj.unsigned;

        sigs[this._userId] = sigs[this._userId] || {};
        sigs[this._userId]["ed25519:" + this._deviceId] = 
            this._account.sign(anotherjson.stringify(obj));
        obj.signatures = sigs;
        if (unsigned !== undefined) {
            obj.unsigned = unsigned;
        }
    }
}
