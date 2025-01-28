/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {Key} from "./common";
import {KeyDescription} from "./common";
import type {Platform} from "../../platform/web/Platform.js";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

const OLM_RECOVERY_KEY_PREFIX = [0x8B, 0x01] as const;

/**
 * @param  {Olm} olm
 * @param  {KeyDescription} keyDescription
 * @param  {string} recoveryKey
 * @return {Key}
 */
export function keyFromRecoveryKey(keyDescription: KeyDescription, recoveryKey: string, olm: Olm, platform: Platform): Key {
    const result = platform.encoding.base58.decode(recoveryKey.replace(/ /g, ''));

    let parity = 0;
    for (const b of result) {
        parity ^= b;
    }
    if (parity !== 0) {
        throw new Error("Incorrect parity");
    }

    for (let i = 0; i < OLM_RECOVERY_KEY_PREFIX.length; ++i) {
        if (result[i] !== OLM_RECOVERY_KEY_PREFIX[i]) {
            throw new Error("Incorrect prefix");
        }
    }

    if (
        result.length !==
        OLM_RECOVERY_KEY_PREFIX.length + olm.PRIVATE_KEY_LENGTH + 1
    ) {
        throw new Error("Incorrect length");
    }

    const keyBits = Uint8Array.from(result.slice(
        OLM_RECOVERY_KEY_PREFIX.length,
        OLM_RECOVERY_KEY_PREFIX.length + olm.PRIVATE_KEY_LENGTH,
    ));

    return new Key(keyDescription, keyBits);
}
