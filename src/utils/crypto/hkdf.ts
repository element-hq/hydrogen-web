/* Copyright 2025 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2018 Jun Kurihara
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type {Crypto} from "../../platform/web/dom/Crypto.js";

// forked this code to make it use the cryptoDriver for HMAC that is more backwards-compatible
export async function hkdf(cryptoDriver: Crypto, key: Uint8Array, salt: Uint8Array, info: Uint8Array, hash: "SHA-256" | "SHA-512", length: number): Promise<Uint8Array> {
    length = length / 8;
    const len = cryptoDriver.digestSize(hash);

    // RFC5869 Step 1 (Extract)
    const prk = await cryptoDriver.hmac.compute(salt, key, hash);

    // RFC5869 Step 2 (Expand)
    let t = new Uint8Array([]);
    const okm = new Uint8Array(Math.ceil(length / len) * len);
    for(let i = 0; i < Math.ceil(length / len); i++){
        const concat = new Uint8Array(t.length + info.length + 1);
        concat.set(t);
        concat.set(info, t.length);
        concat.set(new Uint8Array([i+1]), t.length + info.length);
        t = await cryptoDriver.hmac.compute(prk, concat, hash);
        okm.set(t, len * i);
    }
    return okm.slice(0, length);
}
