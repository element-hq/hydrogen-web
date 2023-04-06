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
import {Key, KeyDescription, KeyDescriptionData} from "./common";
import type {Platform} from "../../platform/web/Platform.js";
import type {Transaction} from "../storage/idb/Transaction";
import type {Storage} from "../storage/idb/Storage";
import type {AccountDataEntry} from "../storage/idb/stores/AccountDataStore";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

type EncryptedData = {
    iv: string;
    ciphertext: string;
    mac: string;
}

export enum DecryptionFailure {
    NoKey = 1,
    NotEncryptedWithKey,
    BadMAC,
    UnsupportedAlgorithm,
}

class DecryptionError extends Error {
    constructor(msg: string, public readonly reason: DecryptionFailure) {
        super(msg);
    }

    toString() {
        return `${this.constructor.name}: ${super.message}: ${this.reason}`
    }
}

type KeyCredentials = {
    type: KeyType,
    credential: string
}

export class SecretStorage {
    // we know the id but don't have the description yet
    private keyId?: string;
    // we have the description but not the credentials yet
    private keyDescription?: KeyDescription;
    // we have the credentials but not the id or description yet
    private keyCredentials?: KeyCredentials;
    // we have everything to compose a valid key
    private key?: Key;
    private readonly platform: Platform;
    private readonly storage: Storage;
    private observedSecrets: Map<string, RetainedObservableValue<string | undefined>>;
    private readonly olm: Olm;
    constructor({platform, storage, olm}: {platform: Platform, storage: Storage, olm: Olm}) {
        this.platform = platform;
        this.storage = storage;
        this.olm = olm;
        this.observedSecrets = new Map();
    }

    load() {
        // read key
    }

    async setKey(type: KeyType, credential: string) {
        const credentials: KeyCredentials = {type, credential};
        this.keyCredentials = credentials;
        this.updateKey(this.keyDescription, this.keyCredentials);
    }

    async setKeyWithDehydratedDeviceKey(dehydrationKey: Key): Promise<boolean> {
        const {keyDescription} = this;
        if (!keyDescription) {
            return false;
        }
        if (await keyDescription.isCompatible(dehydrationKey, this.platform)) {
            const key = dehydrationKey.withDescription(keyDescription);
            this.key = key;
            return true;
        }
        return false;
    }

    private async updateKey(keyDescription: KeyDescription | undefined, credentials: KeyCredentials | undefined): Promise<boolean> {
        if (keyDescription && credentials) {
            if (credentials.type === KeyType.Passphrase) {
                this.key = await keyFromPassphrase(keyDescription, credentials.credential, this.platform);
                return true;
            } else if (credentials.type === KeyType.RecoveryKey) {
                this.key = await keyFromRecoveryKey(keyDescription, credentials.credential, this.olm, this.platform);
                return true;
            }
        }
        return false;
    }

    async writeSync(accountData: ReadonlyArray<AccountDataEntry>, txn: Transaction): Promise<{newKey?: KeyDescription, accountData: ReadonlyArray<AccountDataEntry>}> {
        const newDefaultKey = accountData.find(e => e.type === "m.secret_storage.default_key");
        const keyId: string | undefined = newDefaultKey ? newDefaultKey.content?.key : this.keyId;
        const keyEventType = keyId ? `m.secret_storage.key.${keyId}` : undefined;
        let newKeyData = keyEventType ? accountData.find(e => e.type === keyEventType) : undefined;
        // if the default key was changed but the key itself wasn't in the sync, get it from storage
        if (newDefaultKey && keyEventType && !newKeyData) {
            newKeyData = await txn.accountData.get(keyEventType);
        }
        let newKey: KeyDescription | undefined;
        if (newKeyData && keyId) {
            newKey = new KeyDescription(keyId, newKeyData.content as KeyDescriptionData);
        }
        return {
            newKey,
            accountData
        };
    }

    afterSync({newKey, accountData}: {newKey?: KeyDescription, accountData: ReadonlyArray<AccountDataEntry>}): void {
        if (newKey) {
            this.updateKeyAndAllValues(newKey);
        } else if (this.key) {
            const observedValues = accountData.filter(a => this.observedSecrets.has(a.type));
            Promise.all(observedValues.map(async entry => {
                const observable = this.observedSecrets.get(entry.type)!;
                const secret = await this.decryptAccountData(entry);
                observable.set(secret);
            })).then(undefined, reason => {
                this.platform.logger.log("SecretStorage.afterSync: decryption failed").catch(reason);
            });
        }
    }

    observeSecret(name: string): BaseObservableValue<string | undefined> {
        const existingObservable = this.observedSecrets.get(name);
        if (existingObservable) {
            return existingObservable;
        }
        const observable: RetainedObservableValue<string | undefined> = new RetainedObservableValue(undefined, () => {
            this.observedSecrets.delete(name);
        });
        this.observedSecrets.set(name, observable);
        this.readSecret(name).then(secret => {
            observable.set(secret);
        });
        return observable;
    }

    /** this method will auto-commit any indexeddb transaction because of its use of the webcrypto api */
    async readSecret(name: string): Promise<string | undefined> {
        const txn = await this.storage.readTxn([
            this.storage.storeNames.accountData,
        ]);
        const accountData = await txn.accountData.get(name);
        if (!accountData) {
            return;
        }
        try {
            return await this.decryptAccountData(accountData);
        } catch (err) {
            this.platform.logger.log({l: "SecretStorage.readSecret: failed to read secret", id: name}).catch(err);
            return undefined;
        }
    }

    private async decryptAccountData(accountData: AccountDataEntry): Promise<string | undefined> {
        if (!this.key) {
            throw new DecryptionError("No key set", DecryptionFailure.NoKey);
        }
        const encryptedData = accountData?.content?.encrypted?.[this.key.id] as EncryptedData;
        if (!encryptedData) {
            throw new DecryptionError(`Secret ${accountData.type} is not encrypted for key ${this.key.id}`, DecryptionFailure.NotEncryptedWithKey);
        }

        if (this.key.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
            return await this.decryptAESSecret(accountData.type, encryptedData, this.key.binaryKey);
        } else {
            throw new DecryptionError(`Unsupported algorithm for key ${this.key.id}: ${this.key.algorithm}`, DecryptionFailure.UnsupportedAlgorithm);
        }
    }

    private async decryptAESSecret(type: string, encryptedData: EncryptedData, binaryKey: Uint8Array): Promise<string> {
        const {base64, utf8} = this.platform.encoding;
        // now derive the aes and mac key from the 4s key
        const hkdfKey = await this.platform.crypto.derive.hkdf(
            binaryKey,
            new Uint8Array(8).buffer,   //zero salt
            utf8.encode(type), // info
            "SHA-256",
            512 // 512 bits or 64 bytes
        );
        const aesKey = hkdfKey.slice(0, 32);
        const hmacKey = hkdfKey.slice(32);
        const ciphertextBytes = base64.decode(encryptedData.ciphertext);

        const isVerified = await this.platform.crypto.hmac.verify(
            hmacKey, base64.decode(encryptedData.mac),
            ciphertextBytes, "SHA-256");

        if (!isVerified) {
            throw new DecryptionError("Bad MAC", DecryptionFailure.BadMAC);
        }

        const plaintextBytes = await this.platform.crypto.aes.decryptCTR({
            key: aesKey,
            iv: base64.decode(encryptedData.iv),
            data: ciphertextBytes
        });

        return utf8.decode(plaintextBytes);
    }

    private async updateKeyAndAllValues(newKey: KeyDescription) {
        this.keyDescription = newKey;
        if (await this.updateKey(this.keyDescription, this.keyCredentials)) {
            const valuesToUpdate = Array.from(this.observedSecrets.keys());
            const txn = await this.storage.readTxn([this.storage.storeNames.accountData]);
            const entries = await Promise.all(valuesToUpdate.map(type => txn.accountData.get(type)));
            const foundEntries = entries.filter(e => !!e) as ReadonlyArray<AccountDataEntry>;
            this.decryptAndUpdateEntries(foundEntries);
        }
    }

    private decryptAndUpdateEntries(entries: ReadonlyArray<AccountDataEntry>): void {
        Promise.all(entries.map(async entry => {
            const observable = this.observedSecrets.get(entry.type)!;
            const secret = await this.decryptAccountData(entry);
            observable.set(secret);
        })).then(undefined, reason => {
            this.platform.logger.log("SecretStorage.afterSync: decryption failed").catch(reason);
        });
    }

    /** this method will auto-commit any indexeddb transaction because of its use of the webcrypto api */
    private async hasValidKeyForAnyAccountData() {
        const txn = await this.storage.readTxn([
            this.storage.storeNames.accountData,
        ]);
        const allAccountData = await txn.accountData.getAll();
        for (const accountData of allAccountData) {
            try {
                const secret = await this.decryptAccountData(accountData);
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
}
