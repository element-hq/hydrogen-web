/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {Key} from "./common";
import type {KeyDescription} from "./common";
import type {Platform} from "../../platform/web/Platform.js";

const DEFAULT_ITERATIONS = 500000;
const DEFAULT_BITSIZE = 256;

/**
 * @param  {KeyDescription} keyDescription
 * @param  {string} passphrase
 * @param  {Platform} platform
 * @return {Key}
 */
export async function keyFromPassphrase(keyDescription: KeyDescription, passphrase: string, platform: Platform): Promise<Key> {
    const {passphraseParams} = keyDescription;
    if (!passphraseParams) {
        throw new Error("not a passphrase key");
    }
    if (passphraseParams.algorithm !== "m.pbkdf2") {
        throw new Error(`Unsupported passphrase algorithm: ${passphraseParams.algorithm}`);
    }
    const {utf8} = platform.encoding;
    const keyBits = await platform.crypto.derive.pbkdf2(
        utf8.encode(passphrase),
        passphraseParams.iterations || DEFAULT_ITERATIONS,
        // salt is just a random string, not encoded in any way
        utf8.encode(passphraseParams.salt),
        "SHA-512",
        passphraseParams.bits || DEFAULT_BITSIZE);
    return new Key(keyDescription, keyBits);
}
