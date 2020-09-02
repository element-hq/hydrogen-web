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

import {groupByWithCreator} from "../../../utils/groupBy.js";
import {verifyEd25519Signature, OLM_ALGORITHM} from "./common.js";
import {createSessionEntry} from "./Session.js";

function findFirstSessionId(sessionIds) {
    return sessionIds.reduce((first, sessionId) => {
        if (!first || sessionId < first) {
            return sessionId;
        } else {
            return first;
        }
    }, null);
}

const OTK_ALGORITHM = "signed_curve25519";

export class Encryption {
    constructor({account, olm, olmUtil, userId, storage, now, pickleKey}) {
        this._account = account;
        this._olm = olm;
        this._olmUtil = olmUtil;
        this._userId = userId;
        this._storage = storage;
        this._now = now;
        this._pickleKey = pickleKey;
    }

    async encrypt(type, content, devices, hsApi) {
        const txn = this._storage.readTxn([this._storage.storeNames.olmSessions]);
        const sessionIdsForDevice = await Promise.all(devices.map(async device => {
            return await txn.olmSessions.getSessionIds(device.curve25519Key);
        }));
        const devicesWithoutSession = devices.filter((_, i) => {
            const sessionIds = sessionIdsForDevice[i];
            return !(sessionIds?.length);
        });

        const timestamp = this._now(); 

        let encryptionTuples = [];

        if (devicesWithoutSession.length) {
            const newEncryptionTuples = await this._claimOneTimeKeys(hsApi, devicesWithoutSession);
            try {
                for (const tuple of newEncryptionTuples) {
                    const {device, oneTimeKey} = tuple;
                    tuple.session = this._account.createOutboundOlmSession(device.curve25519Key, oneTimeKey);
                }
                this._storeSessions(newEncryptionTuples, timestamp);
            } catch (err) {
                for (const tuple of newEncryptionTuples) {
                    tuple.dispose();
                }
            }
            encryptionTuples = encryptionTuples.concat(newEncryptionTuples);
        }

        const existingEncryptionTuples = devices.map((device, i) => {
            const sessionIds = sessionIdsForDevice[i];
            if (sessionIds?.length > 0) {
                const sessionId = findFirstSessionId(sessionIds);
                return EncryptionTuple.fromSessionId(device, sessionId);
            }
        }).filter(tuple => !!tuple);
        
        // TODO: if we read and write in two different txns,
        // is there a chance we overwrite a session modified by the decryption during sync?
        // I think so. We'll have to have a lock while sending ...
        await this._loadSessions(existingEncryptionTuples);
        encryptionTuples = encryptionTuples.concat(existingEncryptionTuples);
        const ciphertext = this._buildCipherText(type, content, encryptionTuples);
        await this._storeSessions(encryptionTuples, timestamp);
        return {
            type: "m.room.encrypted",
            content: {
                algorithm: OLM_ALGORITHM,
                sender_key: this._account.identityKeys.curve25519,
                ciphertext
            }
        };
    }

    _buildPlainTextMessageForDevice(type, content, device) {
        return {
            keys: {
                "ed25519": this._account.identityKeys.ed25519
            },
            recipient_keys: {
                "ed25519": device.ed25519Key
            },
            recipient: device.userId,
            sender: this._userId,
            content,
            type
        }
    }

    _buildCipherText(type, content, encryptionTuples) {
        const ciphertext = {};
        for (const {device, session} of encryptionTuples) {
            if (session) {
                const message = session.encrypt(this._buildPlainTextMessageForDevice(type, content, device));
                ciphertext[device.curve25519Key] = message;
            }
        }
        return ciphertext;
    }

    async _claimOneTimeKeys(hsApi, deviceIdentities) {
        // create a Map<userId, Map<deviceId, deviceIdentity>>
        const devicesByUser = groupByWithCreator(deviceIdentities,
            device => device.userId,
            () => new Map(),
            (deviceMap, device) => deviceMap.set(device.deviceId, device)
        );
        const oneTimeKeys = Array.from(devicesByUser.entries()).reduce((usersObj, [userId, deviceMap]) => {
            usersObj[userId] = Array.from(deviceMap.values()).reduce((devicesObj, device) => {
                devicesObj[device.deviceId] = OTK_ALGORITHM;
                return devicesObj;
            }, {});
            return usersObj;
        }, {});
        const claimResponse = await hsApi.claimKeys({
            timeout: 10000,
            one_time_keys: oneTimeKeys
        }).response();
        // TODO: log claimResponse.failures
        const userKeyMap = claimResponse?.["one_time_keys"];
        return this._verifyAndCreateOTKTuples(userKeyMap, devicesByUser);
    }

    _verifyAndCreateOTKTuples(userKeyMap, devicesByUser) {
        const verifiedEncryptionTuples = [];
        for (const [userId, userSection] of Object.entries(userKeyMap)) {
            for (const [deviceId, deviceSection] of Object.entries(userSection)) {
                const [firstPropName, keySection] = Object.entries(deviceSection)[0];
                const [keyAlgorithm] = firstPropName.split(":");
                if (keyAlgorithm === OTK_ALGORITHM) {
                    const device = devicesByUser.get(userId)?.get(deviceId);
                    if (device) {
                        const isValidSignature = verifyEd25519Signature(
                            this._olmUtil, userId, deviceId, device.ed25519Key, keySection);
                        if (isValidSignature) {
                            verifiedEncryptionTuples.push(EncryptionTuple.fromOTK(device, keySection.key));
                        }
                    }
                }
            } 
        }
        return verifiedEncryptionTuples;
    }

    async _loadSessions(encryptionTuples) {
        const txn = this._storage.readTxn([this._storage.storeNames.olmSessions]);
        await Promise.all(encryptionTuples.map(async encryptionTuple => {
            const sessionEntry = await txn.olmSessions.get(
                encryptionTuple.device.curve25519Key, encryptionTuple.sessionId);
            if (sessionEntry) {
                const olmSession = new this._olm.Session();
                encryptionTuple.session = 
            }

        }));
    }

    async _storeSessions(encryptionTuples, timestamp) {
        const txn = this._storage.readWriteTxn([this._storage.storeNames.olmSessions]);
        try {
            for (const tuple of encryptionTuples) {
                const sessionEntry = createSessionEntry(
                    tuple.session, tuple.device.curve25519Key, timestamp, this._pickleKey);
                txn.olmSessions.set(sessionEntry);
            }
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
    }
}

// just a container needed to encrypt a message for a recipient device
// it is constructed with either a oneTimeKey
// (and later converted to a session) in case of a new session
// or an existing session
class EncryptionTuple {
    constructor(device, oneTimeKey, sessionId) {
        this.device = device;
        this.oneTimeKey = oneTimeKey;
        this.sessionId = sessionId;
        // an olmSession, should probably be called olmSession
        this.session = null;
    }

    static fromOTK(device, oneTimeKey) {
        return new EncryptionTuple(device, oneTimeKey, null);
    }

    static fromSessionId(device, sessionId) {
        return new EncryptionTuple(device, null, sessionId);
    }

    dispose() {
        if (this.session) {
            this.session.free();
        }
    }
}
