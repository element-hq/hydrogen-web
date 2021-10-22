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



export class DecryptionResult {
    constructor(event, senderCurve25519Key, claimedEd25519Key) {
        this.event = event;
        this.senderCurve25519Key = senderCurve25519Key;
        this.claimedEd25519Key = claimedEd25519Key;
        this._device = null;
        this._roomTracked = true;
    }

    setDevice(device) {
        this._device = device;
    }

    setRoomNotTrackedYet() {
        this._roomTracked = false;
    }

    get isVerified() {
        if (this._device) {
            const comesFromDevice = this._device.ed25519Key === this.claimedEd25519Key;
            return comesFromDevice;
        }
        return false;
    }

    get isUnverified() {
        if (this._device) {
            return !this.isVerified;
        } else if (this.isVerificationUnknown) {
            return false;
        } else {
            return true;
        }
    }

    get isVerificationUnknown() {
        // verification is unknown if we haven't yet fetched the devices for the room
        return !this._device && !this._roomTracked;
    }
}
