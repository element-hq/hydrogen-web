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

export class KeyDescription {
    constructor(id, keyDescription) {
        this._id = id;
        this._keyDescription = keyDescription;
    }

    get id() {
        return this._id;
    }

    get passphraseParams() {
        return this._keyDescription?.passphrase;
    }

    get algorithm() {
        return this._keyDescription?.algorithm;
    }

    isCompatible(d) {
        const kd = this._keyDescription;
        const kdOther = d._keyDescription;
        if (kd.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
            if (kdOther.algorithm !== kd.algorithm) {
                return false;
            }
            if (kd.passphrase) {
                if (!kdOther.passphrase) {
                    return false;
                }
                return kd.passphrase.algorithm === kdOther.passphrase.algorithm && 
                    kd.passphrase.iterations === kdOther.passphrase.iterations && 
                    kd.passphrase.salt === kdOther.passphrase.salt;
            } else {
                return !!kd.iv && kd.iv === kdOther.iv && 
                    !!kd.mac && kd.mac === kdOther.mac;
            }
        }
        return false;
    }
}

export class Key {
    constructor(keyDescription, binaryKey) {
        this._keyDescription = keyDescription;
        this._binaryKey = binaryKey;
    }

    withDescription(description) {
        return new Key(description, this._binaryKey);
    }

    get description() {
        return this._keyDescription;
    }

    get id() {
        return this._keyDescription.id;
    }

    get binaryKey() {
        return this._binaryKey;
    }

    get algorithm() {
        return this._keyDescription.algorithm;
    }
}
