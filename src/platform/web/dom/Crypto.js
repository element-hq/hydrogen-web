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

import base64 from "base64-arraybuffer";

// turn IE11 result into promise
function subtleCryptoResult(promiseOrOp, method) {
    if (promiseOrOp instanceof Promise) {
        return promiseOrOp;
    } else {
        return new Promise((resolve, reject) => {
            promiseOrOp.oncomplete = e => resolve(e.target.result);
            promiseOrOp.onerror = () => reject(new Error("Crypto error on " + method));
        });
    }
}

class HMACCrypto {
    constructor(subtleCrypto) {
        this._subtleCrypto = subtleCrypto;
    }
    /**
     * [hmac description]
     * @param  {BufferSource} key
     * @param  {BufferSource} mac
     * @param  {BufferSource} data
     * @param  {HashName} hash
     * @return {boolean}
     */
    async verify(key, mac, data, hash) {
        const opts = {
            name: 'HMAC',
            hash: {name: hashName(hash)},
        };
        const hmacKey = await subtleCryptoResult(this._subtleCrypto.importKey(
            'raw',
            key,
            opts,
            false,
            ['verify'],
        ), "importKey");
        const isVerified = await subtleCryptoResult(this._subtleCrypto.verify(
            opts,
            hmacKey,
            mac,
            data,
        ), "verify");
        return isVerified;
    }

    async compute(key, data, hash) {
        const opts = {
            name: 'HMAC',
            hash: {name: hashName(hash)},
        };
        const hmacKey = await subtleCryptoResult(this._subtleCrypto.importKey(
            'raw',
            key,
            opts,
            false,
            ['sign'],
        ), "importKey");
        const buffer = await subtleCryptoResult(this._subtleCrypto.sign(
            opts,
            hmacKey,
            data,
        ), "sign");
        return new Uint8Array(buffer);
    }
}

class DeriveCrypto {
    constructor(subtleCrypto, crypto, cryptoExtras) {
        this._subtleCrypto = subtleCrypto;
        this._crypto = crypto;
        this._cryptoExtras = cryptoExtras;
    }
    /**
     * [pbkdf2 description]
     * @param  {BufferSource} password
     * @param  {Number} iterations
     * @param  {BufferSource} salt
     * @param  {HashName} hash
     * @param  {Number} length  the desired length of the generated key, in bits (not bytes!)
     * @return {BufferSource}
     */
    async pbkdf2(password, iterations, salt, hash, length) {
        if (!this._subtleCrypto.deriveBits) {
            throw new Error("PBKDF2 is not supported");
        }
        const key = await subtleCryptoResult(this._subtleCrypto.importKey(
            'raw',
            password,
            {name: 'PBKDF2'},
            false,
            ['deriveBits'],
        ), "importKey");
        const keybits = await subtleCryptoResult(this._subtleCrypto.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations,
                hash: hashName(hash),
            },
            key,
            length,
        ), "deriveBits");
        return new Uint8Array(keybits);
    }

    /**
     * [hkdf description]
     * @param  {BufferSource} key    [description]
     * @param  {BufferSource} salt   [description]
     * @param  {BufferSource} info   [description]
     * @param  {HashName} hash the hash to use
     * @param  {Number} length desired length of the generated key in bits (not bytes!)
     * @return {[type]}        [description]
     */
    async hkdf(key, salt, info, hash, length) {
        if (!this._subtleCrypto.deriveBits) {
            return this._cryptoExtras.hkdf(this._crypto, key, salt, info, hash, length);
        }
        const hkdfkey = await subtleCryptoResult(this._subtleCrypto.importKey(
            'raw',
            key,
            {name: "HKDF"},
            false,
            ["deriveBits"],
        ), "importKey");
        const keybits = await subtleCryptoResult(this._subtleCrypto.deriveBits({
                name: "HKDF",
                salt,
                info,
                hash: hashName(hash),
            },
            hkdfkey,
            length,
        ), "deriveBits");
        return new Uint8Array(keybits);
    }
}

class AESCrypto {
    constructor(subtleCrypto, crypto) {
        this._subtleCrypto = subtleCrypto;
        this._crypto = crypto;
    }
    /**
     * [decrypt description]
     * @param  {BufferSource} key        [description]
     * @param  {Object} jwkKey        [description]
     * @param  {BufferSource} iv         [description]
     * @param  {BufferSource} data [description]
     * @param  {Number}       counterLength the size of the counter, in bits
     * @return {BufferSource}            [description]
     */
    async decryptCTR({key, jwkKey, iv, data, counterLength = 64}) {
        const opts = {
            name: "AES-CTR",
            counter: iv,
            length: counterLength,
        };
        let aesKey;
        try {
            const selectedKey = key || jwkKey;
            const format = jwkKey ? "jwk" : "raw";
            aesKey = await subtleCryptoResult(this._subtleCrypto.importKey(
                format,
                selectedKey,
                opts,
                false,
                ['decrypt'],
            ), "importKey");
        } catch (err) {
            throw new Error(`Could not import key for AES-CTR decryption: ${err.message}`);
        }
        try {
            const plaintext = await subtleCryptoResult(this._subtleCrypto.decrypt(
                // see https://developer.mozilla.org/en-US/docs/Web/API/AesCtrParams
                opts,
                aesKey,
                data,
            ), "decrypt");
            return new Uint8Array(plaintext);
        } catch (err) {
            throw new Error(`Could not decrypt with AES-CTR: ${err.message}`);
        }
    }

    async encryptCTR({key, jwkKey, iv, data}) {
        const opts = {
            name: "AES-CTR",
            counter: iv,
            length: 64,
        };
        let aesKey;
        const selectedKey = key || jwkKey;
        const format = jwkKey ? "jwk" : "raw";
        try {
            aesKey = await subtleCryptoResult(this._subtleCrypto.importKey(
                format,
                selectedKey,
                opts,
                false,
                ['encrypt'],
            ), "importKey");
        } catch (err) {
            throw new Error(`Could not import key for AES-CTR encryption: ${err.message}`);
        }
        try {
            const ciphertext = await subtleCryptoResult(this._subtleCrypto.encrypt(
                // see https://developer.mozilla.org/en-US/docs/Web/API/AesCtrParams
                opts,
                aesKey,
                data,
            ), "encrypt");
            return new Uint8Array(ciphertext);
        } catch (err) {
            throw new Error(`Could not encrypt with AES-CTR: ${err.message}`);
        }
    }

    /**
     * Generate a CTR key
     * @param  {String} format "raw" or "jwk"
     * @param  {Number} length 128 or 256
     * @return {Promise<Object>}        an object for jwk, or a BufferSource for raw
     */
    async generateKey(format, length = 256) {
        const cryptoKey = await subtleCryptoResult(this._subtleCrypto.generateKey(
            {"name": "AES-CTR", length}, true, ["encrypt", "decrypt"]));
        return subtleCryptoResult(this._subtleCrypto.exportKey(format, cryptoKey));
    }

    async generateIV() {
        return generateIV(this._crypto);
    }
}

function generateIV(crypto) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    const ivArray = new Uint8Array(16);
    for (let i = 0; i < randomBytes.length; i += 1) {
        ivArray[i] = randomBytes[i];
    }
    return ivArray;
}

function jwkKeyToRaw(jwkKey) {
    if (jwkKey.alg !== "A256CTR") {
        throw new Error(`Unknown algorithm: ${jwkKey.alg}`);
    }
    if (!jwkKey.key_ops.includes("decrypt")) {
        throw new Error(`decrypt missing from key_ops`);
    }
    if (jwkKey.kty !== "oct") {
        throw new Error(`Invalid key type, "oct" expected: ${jwkKey.kty}`);
    }
    // convert base64-url to normal base64
    const base64UrlKey = jwkKey.k;
    const base64Key = base64UrlKey.replace(/-/g, "+").replace(/_/g, "/");
    return base64.decode(base64Key);
}

function encodeUnpaddedBase64(buffer) {
    const str = base64.encode(buffer);
    const paddingIdx = str.indexOf("=");
    if (paddingIdx !== -1) {
        return str.substr(0, paddingIdx);
    } else {
        return str;
    }
}

function encodeUrlBase64(buffer) {
    const unpadded = encodeUnpaddedBase64(buffer);
    return unpadded.replace(/\+/g, "-").replace(/\//g, "_");
}

function rawKeyToJwk(key) {
    return {
        "alg": "A256CTR",
        "ext": true,
        "k": encodeUrlBase64(key),
        "key_ops": [
            "encrypt",
            "decrypt"
        ],
        "kty": "oct"
    };
}


class AESLegacyCrypto {
    constructor(aesjs, crypto) {
        this._aesjs = aesjs;
        this._crypto = crypto;
    }
    /**
     * [decrypt description]
     * @param  {BufferSource} key        [description]
     * @param  {BufferSource} iv         [description]
     * @param  {BufferSource} ciphertext [description]
     * @param  {Number}       counterLength the size of the counter, in bits
     * @return {BufferSource}            [description]
     */
    async decryptCTR({key, jwkKey, iv, data, counterLength = 64}) {
        if (counterLength !== 64) {
            throw new Error(`Unsupported counter length: ${counterLength}`);
        }
        if (jwkKey) {
            key = jwkKeyToRaw(jwkKey);
        }
        const aesjs = this._aesjs;
        var aesCtr = new aesjs.ModeOfOperation.ctr(new Uint8Array(key), new aesjs.Counter(new Uint8Array(iv)));
        return aesCtr.decrypt(new Uint8Array(data));
    }

    async encryptCTR({key, jwkKey, iv, data}) {
        if (jwkKey) {
            key = jwkKeyToRaw(jwkKey);
        }
        const aesjs = this._aesjs;
        var aesCtr = new aesjs.ModeOfOperation.ctr(new Uint8Array(key), new aesjs.Counter(new Uint8Array(iv)));
        return aesCtr.encrypt(new Uint8Array(data));
    }

    /**
     * Generate a CTR key
     * @param  {String} format "raw" or "jwk"
     * @param  {Number} length 128 or 256
     * @return {Promise<Object>}        an object for jwk, or a BufferSource for raw
     */
    async generateKey(format, length = 256) {
        let key = crypto.getRandomValues(new Uint8Array(length / 8));
        if (format === "jwk") {
            key = rawKeyToJwk(key);
        }
        return key;
    }

    async generateIV() {
        return generateIV(this._crypto);
    }
}

function hashName(name) {
    if (name !== "SHA-256" && name !== "SHA-512") {
        throw new Error(`Invalid hash name: ${name}`);
    }
    return name;
}

export class Crypto {
    constructor(cryptoExtras) {
        const crypto = window.crypto || window.msCrypto;
        const subtleCrypto = crypto.subtle || crypto.webkitSubtle;
        this._subtleCrypto = subtleCrypto;
        // not exactly guaranteeing AES-CTR support
        // but in practice IE11 doesn't have this
        if (!subtleCrypto.deriveBits && cryptoExtras?.aesjs) {
            this.aes = new AESLegacyCrypto(cryptoExtras.aesjs, crypto);
        } else {
            this.aes = new AESCrypto(subtleCrypto, crypto);
        }
        this.hmac = new HMACCrypto(subtleCrypto);
        this.derive = new DeriveCrypto(subtleCrypto, this, cryptoExtras);
    }

    /**
     * [digest description]
     * @param  {HashName} hash
     * @param  {BufferSource} data
     * @return {BufferSource}
     */
    async digest(hash, data) {
        return await subtleCryptoResult(this._subtleCrypto.digest(hashName(hash), data));
    }

    digestSize(hash) {
        switch (hashName(hash)) {
            case "SHA-512": return 64;
            case "SHA-256": return 32;
            default: throw new Error(`Not implemented for ${hashName(hash)}`);
        }
    }
}
