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

import anotherjson from "another-json";
import {SESSION_E2EE_KEY_PREFIX, OLM_ALGORITHM, MEGOLM_ALGORITHM} from "./common";

// use common prefix so it's easy to clear properties that are not e2ee related during session clear
const ACCOUNT_SESSION_KEY = SESSION_E2EE_KEY_PREFIX + "olmAccount";
const DEVICE_KEY_FLAG_SESSION_KEY = SESSION_E2EE_KEY_PREFIX + "areDeviceKeysUploaded";
const SERVER_OTK_COUNT_SESSION_KEY = SESSION_E2EE_KEY_PREFIX + "serverOTKCount";

async function initiallyStoreAccount(account, pickleKey, areDeviceKeysUploaded, serverOTKCount, storage) {
    const pickledAccount = account.pickle(pickleKey);
    const txn = await storage.readWriteTxn([
        storage.storeNames.session
    ]);
    try {
        // add will throw if the key already exists
        // we would not want to overwrite olmAccount here
        txn.session.add(ACCOUNT_SESSION_KEY, pickledAccount);
        txn.session.add(DEVICE_KEY_FLAG_SESSION_KEY, areDeviceKeysUploaded);
        txn.session.add(SERVER_OTK_COUNT_SESSION_KEY, serverOTKCount);
    } catch (err) {
        txn.abort();
        throw err;
    }
    await txn.complete();
}

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

    static async adoptDehydratedDevice({olm, dehydratedDevice, pickleKey, hsApi, userId, olmWorker, storage}) {
        const account = dehydratedDevice.adoptUnpickledOlmAccount();
        const oneTimeKeys = JSON.parse(account.one_time_keys());
        // only one algorithm supported by olm atm, so hardcode its name
        const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
        const serverOTKCount = oneTimeKeysEntries.length;
        const areDeviceKeysUploaded = true;
        await initiallyStoreAccount(account, pickleKey, areDeviceKeysUploaded, serverOTKCount, storage);
        return new Account({
            pickleKey, hsApi, account, userId,
            deviceId: dehydratedDevice.deviceId,
            areDeviceKeysUploaded, serverOTKCount, olm, olmWorker
        });
    }

    static async create({olm, pickleKey, hsApi, userId, deviceId, olmWorker, storage}) {
        const account = new olm.Account();
        if (olmWorker) {
            await olmWorker.createAccountAndOTKs(account, account.max_number_of_one_time_keys());
        } else {
            account.create();
            account.generate_one_time_keys(account.max_number_of_one_time_keys());
        }
        const areDeviceKeysUploaded = false;
        const serverOTKCount = 0;
        if (storage) {
            await initiallyStoreAccount(account, pickleKey, areDeviceKeysUploaded, serverOTKCount, storage);
        }
        return new Account({pickleKey, hsApi, account, userId,
            deviceId, areDeviceKeysUploaded, serverOTKCount, olm, olmWorker});
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

    setDeviceId(deviceId) {
        this._deviceId = deviceId;
    }

    async uploadKeys(storage, isDehydratedDevice, log) {
        const oneTimeKeys = JSON.parse(this._account.one_time_keys());
        // only one algorithm supported by olm atm, so hardcode its name
        const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
        if (oneTimeKeysEntries.length || !this._areDeviceKeysUploaded) {
            const payload = {};
            if (!this._areDeviceKeysUploaded) {
                log.set("identity", true);
                const identityKeys = JSON.parse(this._account.identity_keys());
                payload.device_keys = this._deviceKeysPayload(identityKeys);
            }
            if (oneTimeKeysEntries.length) {
                log.set("otks", true);
                payload.one_time_keys = this._oneTimeKeysPayload(oneTimeKeysEntries);
            }
            const dehydratedDeviceId = isDehydratedDevice ? this._deviceId : undefined;
            const response = await this._hsApi.uploadKeys(dehydratedDeviceId, payload, {log}).response();
            this._serverOTKCount = response?.one_time_key_counts?.signed_curve25519;
            log.set("serverOTKCount", this._serverOTKCount);
            // TODO: should we not modify this in the txn like we do elsewhere?
            // we'd have to pickle and unpickle the account to clone it though ...
            // and the upload has succeed at this point, so in-memory would be correct
            // but in-storage not if the txn fails. 
            await this._updateSessionStorage(storage, sessionStore => {
                if (oneTimeKeysEntries.length) {
                    this._account.mark_keys_as_published();
                    sessionStore?.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
                    sessionStore?.set(SERVER_OTK_COUNT_SESSION_KEY, this._serverOTKCount);
                }
                if (!this._areDeviceKeysUploaded) {
                    this._areDeviceKeysUploaded = true;
                    sessionStore?.set(DEVICE_KEY_FLAG_SESSION_KEY, this._areDeviceKeysUploaded);
                }
            });
        }
    }

    async generateOTKsIfNeeded(storage, log) {
        // We need to keep a pool of one time public keys on the server so that
        // other devices can start conversations with us. But we can only store
        // a finite number of private keys in the olm Account object.
        // To complicate things further there can be a delay between a device
        // claiming a public one time key from the server and it sending us a
        // message. We need to keep the corresponding private key locally until
        // we receive the message.
        // But that message might never arrive leaving us stuck with duff
        // private keys clogging up our local storage.
        // So we need some kind of engineering compromise to balance all of
        // these factors.
        
        // Check how many keys we can store in the Account object.
        const maxOTKs = this._account.max_number_of_one_time_keys();
        // Try to keep at most half that number on the server. This leaves the
        // rest of the slots free to hold keys that have been claimed from the
        // server but we haven't recevied a message for.
        // If we run out of slots when generating new keys then olm will
        // discard the oldest private keys first. This will eventually clean
        // out stale private keys that won't receive a message.
        const keyLimit = Math.floor(maxOTKs / 2);
        // does the server have insufficient OTKs?
        if (this._serverOTKCount < keyLimit) {
            const oneTimeKeys = JSON.parse(this._account.one_time_keys());
            const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
            const unpublishedOTKCount = oneTimeKeysEntries.length;
            // we want to end up with maxOTKs / 2 key on the server,
            // so generate any on top of the remaining ones on the server and the unpublished ones
            // (we have generated before but haven't uploaded yet for some reason)
            // to get to that number.
            const newKeyCount = keyLimit - unpublishedOTKCount - this._serverOTKCount;
            if (newKeyCount > 0) {
                await log.wrap("generate otks", log => {
                    log.set("max", maxOTKs);
                    log.set("server", this._serverOTKCount);
                    log.set("unpublished", unpublishedOTKCount);
                    log.set("new", newKeyCount);
                    log.set("limit", keyLimit);
                    this._account.generate_one_time_keys(newKeyCount);
                    this._updateSessionStorage(storage, sessionStore => {
                        sessionStore.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
                    });
                });
            }
            // even though we didn't generate any keys, we still have some unpublished ones that should be published
            return true;
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

    async createOutboundOlmSession(theirIdentityKey, theirOneTimeKey) {
        const newSession = new this._olm.Session();
        try {
            if (this._olmWorker) {
                await this._olmWorker.createOutboundOlmSession(this._account, newSession, theirIdentityKey, theirOneTimeKey);
            } else {
                newSession.create_outbound(this._account, theirIdentityKey, theirOneTimeKey);
            }
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

    writeSync(deviceOneTimeKeysCount, txn, log) {
        // we only upload signed_curve25519 otks
        const otkCount = deviceOneTimeKeysCount.signed_curve25519;
        if (Number.isSafeInteger(otkCount) && otkCount !== this._serverOTKCount) {
            txn.session.set(SERVER_OTK_COUNT_SESSION_KEY, otkCount);
            log.set("otkCount", otkCount);
            return otkCount;
        }
    }

    afterSync(otkCount) {
        // could also be undefined
        if (Number.isSafeInteger(otkCount)) {
            this._serverOTKCount = otkCount;
        }
    }

    _keysAsSignableObject(identityKeys) {
        const obj = {
            user_id: this._userId,
            device_id: this._deviceId,
            algorithms: [OLM_ALGORITHM, MEGOLM_ALGORITHM],
            keys: {}
        };
        for (const [algorithm, pubKey] of Object.entries(identityKeys)) {
            obj.keys[`${algorithm}:${this._deviceId}`] = pubKey;
        }
        return obj;
    }

    getUnsignedDeviceKey() {
        const identityKeys = JSON.parse(this._account.identity_keys());
        return this._keysAsSignableObject(identityKeys);
    }

    _deviceKeysPayload(identityKeys) {
        const obj = this._keysAsSignableObject(identityKeys);
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
        if (storage) {
            const txn = await storage.readWriteTxn([
                storage.storeNames.session
            ]);
            try {
                await callback(txn.session);
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
        } else {
            await callback(undefined);
        }
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

    pickleWithKey(key) {
        return this._account.pickle(key);
    }

    dispose() {
        this._account.free();
        this._account = undefined;
    }
}
