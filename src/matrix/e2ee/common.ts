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

import type {UnsentStateEvent} from "../room/common";
import type {ILogItem} from "../../logging/types";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

export enum DecryptionSource {
    Sync, Timeline, Retry
};

// use common prefix so it's easy to clear properties that are not e2ee related during session clear
export const SESSION_E2EE_KEY_PREFIX = "e2ee:";
export const OLM_ALGORITHM = "m.olm.v1.curve25519-aes-sha2";
export const MEGOLM_ALGORITHM = "m.megolm.v1.aes-sha2";

export class DecryptionError extends Error {
    constructor(private readonly code: string, private readonly event: object, private readonly detailsObj?: object) {
        super(`Decryption error ${code}${detailsObj ? ": "+JSON.stringify(detailsObj) : ""}`);
    }
}

export const SIGNATURE_ALGORITHM = "ed25519";

export type SignedValue = {
    signatures?: {[userId: string]: {[keyId: string]: string}}
    unsigned?: object
}

// we store device keys (and cross-signing) in the format we get them from the server
// as that is what the signature is calculated on, so to verify and sign, we need
// it in this format anyway.
export type DeviceKey = SignedValue & {
    readonly user_id: string;
    readonly device_id: string;
    readonly algorithms: ReadonlyArray<string>;
    readonly keys: {[keyId: string]: string};
    readonly unsigned: {
        device_display_name?: string
    }
}

export function getDeviceEd25519Key(deviceKey: DeviceKey): string {
    return deviceKey.keys[`ed25519:${deviceKey.device_id}`];
}

export function getDeviceCurve25519Key(deviceKey: DeviceKey): string {
    return deviceKey.keys[`curve25519:${deviceKey.device_id}`];
}

export function getEd25519Signature(signedValue: SignedValue, userId: string, deviceOrKeyId: string): string | undefined {
    return signedValue?.signatures?.[userId]?.[`${SIGNATURE_ALGORITHM}:${deviceOrKeyId}`];
}

export enum SignatureVerification {
    Valid,
    Invalid,
    NotSigned,
}

export function verifyEd25519Signature(olmUtil: Olm.Utility, userId: string, deviceOrKeyId: string, ed25519Key: string, value: SignedValue, log?: ILogItem): SignatureVerification {
    const signature = getEd25519Signature(value, userId, deviceOrKeyId);
    if (!signature) {
        log?.set("no_signature", true);
        return SignatureVerification.NotSigned;
    }
    const clone = Object.assign({}, value) as object;
    delete clone["unsigned"];
    delete clone["signatures"];
    const canonicalJson = anotherjson.stringify(clone);
    try {
        // throws when signature is invalid
        olmUtil.ed25519_verify(ed25519Key, canonicalJson, signature);
        return SignatureVerification.Valid;
    } catch (err) {
        if (log) {
            const logItem = log.log({l: "Invalid signature, ignoring.", ed25519Key, canonicalJson, signature});
            logItem.error = err;
            logItem.logLevel = log.level.Warn;
        }
        return SignatureVerification.Invalid;
    }
}

export function createRoomEncryptionEvent(): UnsentStateEvent {
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

export enum HistoryVisibility {
    Joined = "joined",
    Invited = "invited",
    WorldReadable = "world_readable",
    Shared = "shared",
};

export function shouldShareKey(membership: string, historyVisibility: HistoryVisibility) {
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
