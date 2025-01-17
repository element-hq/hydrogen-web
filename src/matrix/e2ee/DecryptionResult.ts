/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/


/**
 * @property {object} event the plaintext event (type and content property)
 * @property {string} senderCurve25519Key the curve25519 sender key of the olm event
 * @property {string} claimedEd25519Key The ed25519 fingerprint key retrieved from the decryption payload.
 *                                      The sender of the olm event claims this is the ed25519 fingerprint key
 *                                      that matches the curve25519 sender key.
 *                                      The caller needs to check if this key does indeed match the senderKey
 *                                      for a device with a valid signature returned from /keys/query,
 *                                      see DeviceTracker
 */

import {getDeviceEd25519Key} from "./common";
import type {DeviceKey} from "./common";
import type {TimelineEvent} from "../storage/types";

type DecryptedEvent = {
    type?: string,
    content?: Record<string, any>
}

export class DecryptionResult {
    public device?: DeviceKey;

    constructor(
        public readonly event: DecryptedEvent,
        public readonly senderCurve25519Key: string,
        public readonly claimedEd25519Key: string,
        public readonly encryptedEvent?: TimelineEvent
    ) {}

    setDevice(device: DeviceKey): void {
        this.device = device;
    }

    get isVerified(): boolean {
        if (this.device) {
            const comesFromDevice = getDeviceEd25519Key(this.device) === this.claimedEd25519Key;
            return comesFromDevice;
        }
        return false;
    }

    get isUnverified(): boolean {
        if (this.device) {
            return !this.isVerified;
        } else {
            return true;
        }
    }

    get userId(): string | undefined {
        return this.device?.user_id;
    }

    get deviceId(): string | undefined {
        return this.device?.device_id;
    }

    get isVerificationUnknown(): boolean {
        return !this.device;
    }
}
