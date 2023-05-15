/*
Copyright 2016-2023 The Matrix.org Foundation C.I.C.

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

import { PkSigning } from "@matrix-org/olm";
import anotherjson from "another-json";
import type {SignedValue} from "../e2ee/common";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

// from matrix-js-sdk
/**
 * Sign a JSON object using public key cryptography
 * @param obj - Object to sign.  The object will be modified to include
 *     the new signature
 * @param key - the signing object or the private key
 * seed
 * @param userId - The user ID who owns the signing key
 * @param pubKey - The public key (ignored if key is a seed)
 * @returns the signature for the object
 */
 export function pkSign(olmUtil: Olm, obj: SignedValue, key: Uint8Array | PkSigning, userId: string, pubKey: string): string {
    let createdKey = false;
    if (key instanceof Uint8Array) {
        const keyObj = new olmUtil.PkSigning();
        pubKey = keyObj.init_with_seed(key);
        key = keyObj;
        createdKey = true;
    }
    const sigs = obj.signatures || {};
    delete obj.signatures;
    const unsigned = obj.unsigned;
    if (obj.unsigned) delete obj.unsigned;
    try {
        const mysigs = sigs[userId] || {};
        sigs[userId] = mysigs;

        return (mysigs["ed25519:" + pubKey] = key.sign(anotherjson.stringify(obj)));
    } finally {
        obj.signatures = sigs;
        if (unsigned) obj.unsigned = unsigned;
        if (createdKey) {
            key.free();
        }
    }
}
