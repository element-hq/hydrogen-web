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

export class SessionBackup {
    constructor({backupInfo, decryption, hsApi}) {
        this._backupInfo = backupInfo;
        this._decryption = decryption;
        this._hsApi = hsApi;
    }

    async getSession(roomId, sessionId, log) {
        const sessionResponse = await this._hsApi.roomKeyForRoomAndSession(this._backupInfo.version, roomId, sessionId, {log}).response();
        const sessionInfo = this._decryption.decrypt(
            sessionResponse.session_data.ephemeral,
            sessionResponse.session_data.mac,
            sessionResponse.session_data.ciphertext,
        );
        return JSON.parse(sessionInfo);
    }

    get version() {
        return this._backupInfo.version;
    }

    dispose() {
        this._decryption.free();
    }

    static async fromSecretStorage({platform, olm, secretStorage, hsApi, txn}) {
        const base64PrivateKey = await secretStorage.readSecret("m.megolm_backup.v1", txn);
        if (base64PrivateKey) {
            const privateKey = new Uint8Array(platform.encoding.base64.decode(base64PrivateKey));
            const backupInfo = await hsApi.roomKeysVersion().response();
            const expectedPubKey = backupInfo.auth_data.public_key;
            const decryption = new olm.PkDecryption();
            try {
                const pubKey = decryption.init_with_private_key(privateKey);
                if (pubKey !== expectedPubKey) {
                    throw new Error(`Bad backup key, public key does not match. Calculated ${pubKey} but expected ${expectedPubKey}`);
                }
            } catch(err) {
                decryption.free();
                throw err;
            }
            return new SessionBackup({backupInfo, decryption, hsApi});
        }
    }
}

