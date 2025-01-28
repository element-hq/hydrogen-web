/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {Platform} from "../../platform/web/Platform.js";

export type KeyDescriptionData = {
    algorithm: string;
    passphrase: {
        algorithm: string;
        iterations: number;
        salt: string;
        bits?: number;
    };
    mac: string;
    iv: string;
}

export class KeyDescription {
    private readonly _id: string;
    private readonly _keyDescription: KeyDescriptionData;

    constructor(id: string, keyDescription: KeyDescriptionData) {
        this._id = id;
        this._keyDescription = keyDescription;
    }

    get id(): string {
        return this._id;
    }

    get passphraseParams(): KeyDescriptionData["passphrase"] {
        return this._keyDescription?.passphrase;
    }

    get algorithm(): string {
        return this._keyDescription?.algorithm;
    }

    async isCompatible(key: Key, platform: Platform): Promise<boolean> {
        if (this.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
            const kd = this._keyDescription;
            if (kd.mac) {
                const otherMac = await calculateKeyMac(key.binaryKey, kd.iv, platform);
                return kd.mac === otherMac;
            } else if (kd.passphrase) {
                const kdOther = key.description._keyDescription;
                if (!kdOther.passphrase) {
                    return false;
                }
                return kd.passphrase.algorithm === kdOther.passphrase.algorithm && 
                    kd.passphrase.iterations === kdOther.passphrase.iterations && 
                    kd.passphrase.salt === kdOther.passphrase.salt;
            }
        }
        return false;
    }
}

export class Key {
    private readonly _keyDescription: KeyDescription;
    private readonly _binaryKey: Uint8Array;

    constructor(keyDescription: KeyDescription, binaryKey: Uint8Array) {
        this._keyDescription = keyDescription;
        this._binaryKey = binaryKey;
    }

    withDescription(description: KeyDescription): Key {
        return new Key(description, this._binaryKey);
    }

    get description(): KeyDescription {
        return this._keyDescription;
    }

    get id(): string {
        return this._keyDescription.id;
    }

    get binaryKey(): Uint8Array {
        return this._binaryKey;
    }

    get algorithm(): string {
        return this._keyDescription.algorithm;
    }
}

async function calculateKeyMac(key: BufferSource, ivStr: string, platform: Platform): Promise<string> {
    const {crypto, encoding} = platform;
    const {utf8, base64} = encoding;
    const {derive, aes, hmac} = crypto;

    const iv = base64.decode(ivStr);

    // salt for HKDF, with 8 bytes of zeros
    const zerosalt = new Uint8Array(8);
    const ZERO_STR = "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
    
    const info = utf8.encode("");
    const keybits = await derive.hkdf(key, zerosalt, info, "SHA-256", 512);
    const aesKey = keybits.slice(0, 32);
    const hmacKey = keybits.slice(32);
    const ciphertext = await aes.encryptCTR({key: aesKey, iv, data: utf8.encode(ZERO_STR)});
    const mac = await hmac.compute(hmacKey, ciphertext, "SHA-256");

    return base64.encode(mac);
}
