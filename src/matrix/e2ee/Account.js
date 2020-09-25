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
import {SESSION_KEY_PREFIX, OLM_ALGORITHM, MEGOLM_ALGORITHM} from "./common.js";

// use common prefix so it's easy to clear properties that are not e2ee related during session clear
const ACCOUNT_SESSION_KEY = SESSION_KEY_PREFIX + "olmAccount";
const DEVICE_KEY_FLAG_SESSION_KEY = SESSION_KEY_PREFIX + "areDeviceKeysUploaded";
const SERVER_OTK_COUNT_SESSION_KEY = SESSION_KEY_PREFIX + "serverOTKCount";

export class Account {
    static async load({olm, pickleKey, hsApi, userId, deviceId, olmWorker, txn}) {
        const pickledAccount = await txn.session.get(ACCOUNT_SESSION_KEY);
        if (pickledAccount) {
            const account = new olm.Account();
            const areDeviceKeysUploaded = await txn.session.get(DEVICE_KEY_FLAG_SESSION_KEY);
            account.unpickle(pickleKey, pickledAccount);
            const serverOTKCount = await txn.session.get(SERVER_OTK_COUNT_SESSION_KEY);
            return new Account({pickleKey, hsApi, account, userId,
                deviceId, areDeviceKeysUploaded, serverOTKCount, olm, olmWorker});
        }
    }

    static async create({olm, pickleKey, hsApi, userId, deviceId, olmWorker, storage}) {
        const account = new olm.Account();
        if (olmWorker) {
            await olmWorker.createAccountAndOTKs(account, account.max_number_of_one_time_keys());
        } else {
            account.create();
            account.generate_one_time_keys(account.max_number_of_one_time_keys());
        }
        const pickledAccount = account.pickle(pickleKey);
        const areDeviceKeysUploaded = false;
        const txn = storage.readWriteTxn([
            storage.storeNames.session
        ]);
        try {
            // add will throw if the key already exists
            // we would not want to overwrite olmAccount here
            txn.session.add(ACCOUNT_SESSION_KEY, pickledAccount);
            txn.session.add(DEVICE_KEY_FLAG_SESSION_KEY, areDeviceKeysUploaded);
            txn.session.add(SERVER_OTK_COUNT_SESSION_KEY, 0);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        return new Account({pickleKey, hsApi, account, userId,
            deviceId, areDeviceKeysUploaded, serverOTKCount: 0, olm, olmWorker});
    }

    constructor({pickleKey, hsApi, account, userId, deviceId, areDeviceKeysUploaded, serverOTKCount, olm, olmWorker}) {
        this._olm = olm;
        this._pickleKey = pickleKey;
        this._hsApi = hsApi;
        this._account = account;
        this._userId = userId;
        this._deviceId = deviceId;
        this._areDeviceKeysUploaded = areDeviceKeysUploaded;
        this._serverOTKCount = serverOTKCount;
        this._olmWorker = olmWorker;
        this._identityKeys = JSON.parse(this._account.identity_keys());
    }

    get identityKeys() {
        return this._identityKeys;
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
            const response = await this._hsApi.uploadKeys(payload).response();
            this._serverOTKCount = response?.one_time_key_counts?.signed_curve25519;
            // TODO: should we not modify this in the txn like we do elsewhere?
            // we'd have to pickle and unpickle the account to clone it though ...
            // and the upload has succeed at this point, so in-memory would be correct
            // but in-storage not if the txn fails. 
            await this._updateSessionStorage(storage, sessionStore => {
                if (oneTimeKeysEntries.length) {
                    this._account.mark_keys_as_published();
                    sessionStore.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
                    sessionStore.set(SERVER_OTK_COUNT_SESSION_KEY, this._serverOTKCount);
                }
                if (!this._areDeviceKeysUploaded) {
                    this._areDeviceKeysUploaded = true;
                    sessionStore.set(DEVICE_KEY_FLAG_SESSION_KEY, this._areDeviceKeysUploaded);
                }
            });
        }
    }

    async generateOTKsIfNeeded(storage) {
        const maxOTKs = this._account.max_number_of_one_time_keys();
        const limit = maxOTKs / 2;
        if (this._serverOTKCount < limit) {
            // TODO: cache unpublishedOTKCount, so we don't have to parse this JSON on every sync iteration
            // for now, we only determine it when serverOTKCount is sufficiently low, which is should rarely be,
            // and recheck
            const oneTimeKeys = JSON.parse(this._account.one_time_keys());
            const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
            const unpublishedOTKCount = oneTimeKeysEntries.length;
            const totalOTKCount = this._serverOTKCount + unpublishedOTKCount;
            if (totalOTKCount < limit) {
                // we could in theory also generated the keys and store them in
                // writeSync, but then we would have to clone the account to avoid side-effects.
                await this._updateSessionStorage(storage, sessionStore => {
                    const newKeyCount = maxOTKs - totalOTKCount;
                    this._account.generate_one_time_keys(newKeyCount);
                    sessionStore.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
                });
                return true;
            }
        }
        return false;
    }

    createInboundOlmSession(senderKey, body) {
        const newSession = new this._olm.Session();
        try {
            newSession.create_inbound_from(this._account, senderKey, body);
            return newSession;
        } catch (err) {
            newSession.free();
            throw err;
        }
    }

    createOutboundOlmSession(theirIdentityKey, theirOneTimeKey) {
        const newSession = new this._olm.Session();
        try {
            newSession.create_outbound(this._account, theirIdentityKey, theirOneTimeKey);
            return newSession;
        } catch (err) {
            newSession.free();
            throw err;
        }
    }

    writeRemoveOneTimeKey(session, txn) {
        // this is side-effecty and will have applied the change if the txn fails,
        // but don't want to clone the account for now
        // and it is not the worst thing to think we have used a OTK when
        // decrypting the message that actually used it threw for some reason.
        this._account.remove_one_time_keys(session);
        txn.session.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
    }

    writeSync(deviceOneTimeKeysCount, txn) {
        // we only upload signed_curve25519 otks
        const otkCount = deviceOneTimeKeysCount.signed_curve25519 || 0;
        if (Number.isSafeInteger(otkCount) && otkCount !== this._serverOTKCount) {
            txn.session.set(SERVER_OTK_COUNT_SESSION_KEY, otkCount);
            return otkCount;
        }
    }

    afterSync(otkCount) {
        // could also be undefined
        if (Number.isSafeInteger(otkCount)) {
            this._serverOTKCount = otkCount;
        }
    }

    _deviceKeysPayload(identityKeys) {
        const obj = {
            user_id: this._userId,
            device_id: this._deviceId,
            algorithms: [OLM_ALGORITHM, MEGOLM_ALGORITHM],
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
        const txn = storage.readWriteTxn([
            storage.storeNames.session
        ]);
        try {
            await callback(txn.session);
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
