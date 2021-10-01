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

/**
 * Decrypt an attachment.
 * @param {ArrayBuffer} ciphertextBuffer The encrypted attachment data buffer.
 * @param {Object} info The information needed to decrypt the attachment.
 * @param {Object} info.key AES-CTR JWK key object.
 * @param {string} info.iv Base64 encoded 16 byte AES-CTR IV.
 * @param {string} info.hashes.sha256 Base64 encoded SHA-256 hash of the ciphertext.
 * @return {Promise} A promise that resolves with an ArrayBuffer when the attachment is decrypted.
 */
export async function decryptAttachment(platform, ciphertextBuffer, info) {
    if (info === undefined || info.key === undefined || info.iv === undefined
        || info.hashes === undefined || info.hashes.sha256 === undefined) {
       throw new Error("Invalid info. Missing info.key, info.iv or info.hashes.sha256 key");
    }

    const {crypto} = platform;
    const {base64} = platform.encoding;
    var ivArray = base64.decode(info.iv);
    // re-encode to not deal with padded vs unpadded
    var expectedSha256base64 = base64.encode(base64.decode(info.hashes.sha256));
    // Check the sha256 hash
    const digestResult = await crypto.digest("SHA-256", ciphertextBuffer);
    if (base64.encode(new Uint8Array(digestResult)) != expectedSha256base64) {
        throw new Error("Mismatched SHA-256 digest");
    }
    var counterLength;
    if (info.v == "v1" || info.v == "v2") {
        // Version 1 and 2 use a 64 bit counter.
        counterLength = 64;
    } else {
        // Version 0 uses a 128 bit counter.
        counterLength = 128;
    }

    const decryptedBuffer = await crypto.aes.decryptCTR({
        jwkKey: info.key,
        iv: ivArray,
        data: ciphertextBuffer,
        counterLength
    });
    return decryptedBuffer;
}

export async function encryptAttachment(platform, blob) {
    const {crypto} = platform;
    const {base64} = platform.encoding;
    const iv = await crypto.aes.generateIV();
    const key = await crypto.aes.generateKey("jwk", 256);
    const buffer = await blob.readAsBuffer();
    const ciphertext = await crypto.aes.encryptCTR({jwkKey: key, iv, data: buffer});
    const digest = await crypto.digest("SHA-256", ciphertext);
    return {
        blob: platform.createBlob(ciphertext, 'application/octet-stream'),
        info: {
            v: "v2",
            key,
            iv: base64.encodeUnpadded(iv),
            hashes: {
                sha256: base64.encodeUnpadded(digest)
            }
        }
    };
}
