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

import anotherjson from "another-json";
import {createEnum} from "../../utils/enum";

export const DecryptionSource = createEnum("Sync", "Timeline", "Retry");

// use common prefix so it's easy to clear properties that are not e2ee related during session clear
export const SESSION_E2EE_KEY_PREFIX = "e2ee:";
export const OLM_ALGORITHM = "m.olm.v1.curve25519-aes-sha2";
export const MEGOLM_ALGORITHM = "m.megolm.v1.aes-sha2";

export class DecryptionError extends Error {
    constructor(code, event, detailsObj = null) {
        super(`Decryption error ${code}${detailsObj ? ": "+JSON.stringify(detailsObj) : ""}`);
        this.code = code;
        this.event = event;
        this.details = detailsObj;
    }
}

export const SIGNATURE_ALGORITHM = "ed25519";

export function verifyEd25519Signature(olmUtil, userId, deviceOrKeyId, ed25519Key, value, log = undefined) {
    const clone = Object.assign({}, value);
    delete clone.unsigned;
    delete clone.signatures;
    const canonicalJson = anotherjson.stringify(clone);
    const signature = value?.signatures?.[userId]?.[`${SIGNATURE_ALGORITHM}:${deviceOrKeyId}`];
    try {
        if (!signature) {
            throw new Error("no signature");
        }
        // throws when signature is invalid
        olmUtil.ed25519_verify(ed25519Key, canonicalJson, signature);
        return true;
    } catch (err) {
        if (log) {
            const logItem = log.log({l: "Invalid signature, ignoring.", ed25519Key, canonicalJson, signature});
            logItem.error = err;
            logItem.logLevel = log.level.Warn;
        }
        return false;
    }
}

export function createRoomEncryptionEvent() {
    return {
        "type": "m.room.encryption",
        "state_key": "",
        "content": {
            "algorithm": MEGOLM_ALGORITHM,
            "rotation_period_ms": 604800000,
            "rotation_period_msgs": 100
        }
    }
}


// Use enum when converting to TS
export const HistoryVisibility = Object.freeze({
    Joined: "joined",
    Invited: "invited",
    WorldReadable: "world_readable",
    Shared: "shared",
});

export function shouldShareKey(membership, historyVisibility) {
    switch (historyVisibility) {
        case HistoryVisibility.WorldReadable:
            return true;
        case HistoryVisibility.Shared:
            // was part of room at some time
            return membership !== undefined;
        case HistoryVisibility.Joined:
            return membership === "join";
        case HistoryVisibility.Invited:
            return membership === "invite" || membership === "join";
        default:
            return false;
    }
}
