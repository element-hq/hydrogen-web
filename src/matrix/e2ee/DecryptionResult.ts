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
 * @property {object} event the plaintext event (type and content property)
 * @property {string} senderCurve25519Key the curve25519 sender key of the olm event
 * @property {string} claimedEd25519Key The ed25519 fingerprint key retrieved from the decryption payload.
 *                                      The sender of the olm event claims this is the ed25519 fingerprint key
 *                                      that matches the curve25519 sender key.
 *                                      The caller needs to check if this key does indeed match the senderKey
 *                                      for a device with a valid signature returned from /keys/query,
 *                                      see DeviceTracker
 */

import type {DeviceIdentity} from "../storage/idb/stores/DeviceIdentityStore";
import type {TimelineEvent} from "../storage/types";

type DecryptedEvent = {
    type?: string,
    content?: Record<string, any>
}

export class DecryptionResult {
    private device?: DeviceIdentity;

    constructor(
        public readonly event: DecryptedEvent,
        public readonly senderCurve25519Key: string,
        public readonly claimedEd25519Key: string,
        public readonly encryptedEvent?: TimelineEvent
    ) {}

    setDevice(device: DeviceIdentity): void {
        this.device = device;
    }

    get isVerified(): boolean {
        if (this.device) {
            const comesFromDevice = this.device.ed25519Key === this.claimedEd25519Key;
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

    get isVerificationUnknown(): boolean {
        return !this.device;
    }
}
