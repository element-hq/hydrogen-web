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
    constructor(subtleCrypto) {
        this._subtleCrypto = subtleCrypto;
    }
    /**
     * [decrypt description]
     * @param  {BufferSource} key        [description]
     * @param  {BufferSource} iv         [description]
     * @param  {BufferSource} ciphertext [description]
     * @return {BufferSource}            [description]
     */
    async decrypt(key, iv, ciphertext) {
        const opts = {
            name: "AES-CTR",
            counter: iv,
            length: 64,
        };
        let aesKey;
        try {
            aesKey = await subtleCryptoResult(this._subtleCrypto.importKey(
                'raw',
                key,
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
                ciphertext,
            ), "decrypt");
            return new Uint8Array(plaintext);
        } catch (err) {
            throw new Error(`Could not decrypt with AES-CTR: ${err.message}`);
        }
    }
}


class AESLegacyCrypto {
    constructor(aesjs) {
        this._aesjs = aesjs;
    }
    /**
     * [decrypt description]
     * @param  {BufferSource} key        [description]
     * @param  {BufferSource} iv         [description]
     * @param  {BufferSource} ciphertext [description]
     * @return {BufferSource}            [description]
     */
    async decrypt(key, iv, ciphertext) {
        const aesjs = this._aesjs;
        var aesCtr = new aesjs.ModeOfOperation.ctr(new Uint8Array(key), new aesjs.Counter(new Uint8Array(iv)));
        return aesCtr.decrypt(new Uint8Array(ciphertext));
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
            this.aes = new AESLegacyCrypto(cryptoExtras.aesjs);
        } else {
            this.aes = new AESCrypto(subtleCrypto);
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
