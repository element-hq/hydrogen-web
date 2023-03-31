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
import {BaseObservableValue, RetainedObservableValue} from "../../observable/value";
import {KeyType} from "./index";
import {keyFromPassphrase} from "./passphrase";
import {keyFromRecoveryKey} from "./recoveryKey";
import type {Key, KeyDescription} from "./common";
import type {Platform} from "../../platform/web/Platform.js";
import type {Transaction} from "../storage/idb/Transaction";
import type {Storage} from "../storage/idb/Storage";
import type {AccountDataEntry} from "../storage/idb/stores/AccountDataStore";

type EncryptedData = {
    iv: string;
    ciphertext: string;
    mac: string;
}

export enum DecryptionFailure {
    NotEncryptedWithKey,
    BadMAC,
    UnsupportedAlgorithm,
}

class DecryptionError extends Error {
    constructor(msg: string, public readonly reason: DecryptionFailure) {
        super(msg);
    }
}

type AccountData = {type: string, content: Record<string, any>};

type KeyCredentials = {
    type: KeyType,
    credential: string
}

export class SecretStorage {
    // we know the id but don't have the description yet
    private _keyId?: string;
    // we have the description but not the credentials yet
    private _keyDescription?: KeyDescription;
    // we have the credentials but not the id or description yet
    private _keyCredentials?: KeyCredentials;
    // we have everything to compose a valid key
    private _key?: Key;
    private readonly _platform: Platform;
    private readonly _storage: Storage;
    private observedSecrets: Map<string, RetainedObservableValue<string | undefined>>;

    constructor({key, platform, storage}: {key: Key, platform: Platform, storage: Storage}) {
        this._key = key;
        this._platform = platform;
        this._storage = storage;
    }

    load() {
        // read key
    }

    async setKey(type: KeyType, credential: string) {
        const credentials: KeyCredentials = {type, credential};
        this._keyCredentials = credentials;
        this.updateKey(this._keyDescription, this._keyCredentials);
    }

    async setKeyWithDehydratedDeviceKey() {
        
    }

    private async updateKey(keyDescription: KeyDescription | undefined, credentials: KeyCredentials | undefined, txn: Transaction) {
        if (keyDescription && credentials) {
            if (credentials.type === KeyType.Passphrase) {
                this._key = await keyFromPassphrase(keyDescription, credentials.credential, this._platform);
            } else if (credentials.type === KeyType.RecoveryKey) {
                this._key = await keyFromRecoveryKey(keyDescription, credentials.credential, this._olm, this._platform);
            }
            // 
        }
    }

    private update(keyDescription: KeyDescription, credentials: KeyCredentials) {

    }

    writeSync(accountData: ReadonlyArray<AccountData>, txn: Transaction, log: ILogItem): Promise<void> {

        const newDefaultKey = accountData.find(e => e.type === "m.secret_storage.default_key");
        const keyId: string | undefined = newDefaultKey ? newDefaultKey.content?.key : this._keyId;
        const keyEventType = keyId ? `m.secret_storage.key.${keyId}` : undefined;
        let newKey = keyEventType ? accountData.find(e => e.type === keyEventType) : undefined;
        if (newDefaultKey && keyEventType && !newKey) {
            newKey = await txn.accountData.get(keyEventType);
        }
        if (newKey) {
            this.setKeyDescription()
        }
        const keyChanged = !!newDefaultKey || !!newKey;
        if (keyChanged) {
            // update all values
        } else {
            for(const event of accountData) {

            }
        }
    }

    afterSync(): void {
    }

    /** this method will auto-commit any indexeddb transaction because of its use of the webcrypto api */
    async hasValidKeyForAnyAccountData() {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.accountData,
        ]);
        const allAccountData = await txn.accountData.getAll();
        for (const accountData of allAccountData) {
            try {
                const secret = await this._decryptAccountData(accountData);
                return true; // decryption succeeded
            } catch (err) {
                if (err instanceof DecryptionError && err.reason !== DecryptionFailure.NotEncryptedWithKey) {
                    throw err;
                } else {
                    continue;
                }
            }
        }
        return false;
    }

    observeSecret(name: string): BaseObservableValue<string | undefined> {

    }

    /** this method will auto-commit any indexeddb transaction because of its use of the webcrypto api */
    async readSecret(name: string): Promise<string | undefined> {
        const txn = await this._storage.readTxn([
            this._storage.storeNames.accountData,
        ]);
        const accountData = await txn.accountData.get(name);
        if (!accountData) {
            return;
        }
        return await this._decryptAccountData(accountData);
    }

    async _decryptAccountData(accountData: AccountDataEntry): Promise<string> {
        const encryptedData = accountData?.content?.encrypted?.[this._key.id] as EncryptedData;
        if (!encryptedData) {
            throw new DecryptionError(`Secret ${accountData.type} is not encrypted for key ${this._key.id}`, DecryptionFailure.NotEncryptedWithKey);
        }

        if (this._key.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
            return await this._decryptAESSecret(accountData.type, encryptedData);
        } else {
            throw new DecryptionError(`Unsupported algorithm for key ${this._key.id}: ${this._key.algorithm}`, DecryptionFailure.UnsupportedAlgorithm);
        }
    }

    async _decryptAESSecret(type: string, encryptedData: EncryptedData): Promise<string> {
        const {base64, utf8} = this._platform.encoding;
        // now derive the aes and mac key from the 4s key
        const hkdfKey = await this._platform.crypto.derive.hkdf(
            this._key.binaryKey,
            new Uint8Array(8).buffer,   //zero salt
            utf8.encode(type), // info
            "SHA-256",
            512 // 512 bits or 64 bytes
        );
        const aesKey = hkdfKey.slice(0, 32);
        const hmacKey = hkdfKey.slice(32);
        const ciphertextBytes = base64.decode(encryptedData.ciphertext);

        const isVerified = await this._platform.crypto.hmac.verify(
            hmacKey, base64.decode(encryptedData.mac),
            ciphertextBytes, "SHA-256");

        if (!isVerified) {
            throw new DecryptionError("Bad MAC", DecryptionFailure.BadMAC);
        }

        const plaintextBytes = await this._platform.crypto.aes.decryptCTR({
            key: aesKey,
            iv: base64.decode(encryptedData.iv),
            data: ciphertextBytes
        });

        return utf8.decode(plaintextBytes);
    }
}
