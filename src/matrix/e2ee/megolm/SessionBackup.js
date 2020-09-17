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

import {base64} from "../../utils/base-encoding.js";

export class SessionBackup {
    constructor({olm, backupInfo, privateKey, hsApi}) {
        this._olm = olm;
        this._backupInfo = backupInfo;
        this._privateKey = privateKey;
        this._hsApi = hsApi;
    }

    async getSession(roomId, sessionId) {
        const sessionResponse = await this._hsApi.roomKey(this._backupInfo.version, roomId, sessionId).response();
        let sessionInfo;
        const decryption = new this._olm.PkDecryption();
        try {
            decryption.init_with_private_key(this._privateKey);
            sessionInfo = this._decryption.decrypt(
                sessionResponse.session_data.ephemeral,
                sessionResponse.session_data.mac,
                sessionResponse.session_data.ciphertext,
            );
        } finally {
            decryption.free();
        }
        return JSON.parse(sessionInfo);
    }

    static async fromSecretStorage({olm, secretStorage, hsApi}) {
        const backupInfo = await hsApi.roomKeysVersion().response();
        const base64PrivateKey = await secretStorage.readSecret("m.megolm_backup.v1");
        if (base64PrivateKey) {
            const privateKey = base64.decode(base64PrivateKey);
            const decryption = new olm.PkDecryption();
            try {
                const pubKey = decryption.init_with_private_key(this._privateKey);
                if (pubKey !== backupInfo.auth_data.public_key) {
                    throw new Error(`Bad backup key, public key does not match. Calculated ${pubKey} but expected ${backupInfo.auth_data.public_key}`);
                }
            } finally {
                decryption.free();
            }
            return new SessionBackup({olm, backupInfo, privateKey, hsApi});
        }
    }
}

