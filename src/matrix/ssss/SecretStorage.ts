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
import type {Key} from "./common";
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

export class SecretStorage {
    private readonly _key: Key;
    private readonly _platform: Platform;
    private readonly _storage: Storage;

    constructor({key, platform, storage}: {key: Key, platform: Platform, storage: Storage}) {
        this._key = key;
        this._platform = platform;
        this._storage = storage;
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
