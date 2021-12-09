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

type EncryptedData = {
    iv: string;
    ciphertext: string;
    mac: string;
}

export class SecretStorage {
    private readonly _key: Key;
    private readonly _platform: Platform;

    constructor({key, platform}: {key: Key, platform: Platform}) {
        this._key = key;
        this._platform = platform;
    }

    async readSecret(name: string, txn: Transaction): Promise<string | undefined> {
        const accountData = await txn.accountData.get(name);
        if (!accountData) {
            return;
        }
        const encryptedData = accountData?.content?.encrypted?.[this._key.id] as EncryptedData;
        if (!encryptedData) {
            throw new Error(`Secret ${accountData.type} is not encrypted for key ${this._key.id}`);
        }

        if (this._key.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
            return await this._decryptAESSecret(accountData.type, encryptedData);
        } else {
            throw new Error(`Unsupported algorithm for key ${this._key.id}: ${this._key.algorithm}`);
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
            throw new Error("Bad MAC");
        }

        const plaintextBytes = await this._platform.crypto.aes.decryptCTR({
            key: aesKey,
            iv: base64.decode(encryptedData.iv),
            data: ciphertextBytes
        });

        return utf8.decode(plaintextBytes);
    }
}
