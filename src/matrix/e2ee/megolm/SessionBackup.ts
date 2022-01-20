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

import type {HomeServerApi} from "../../net/HomeServerApi";
import type {RoomKey} from "./decryption/RoomKey";
import type {KeyLoader} from "./decryption/KeyLoader";
import type {SecretStorage} from "../../ssss/SecretStorage";
import type {ILogItem} from "../../../logging/types";
import type {Platform} from "../../../platform/web/Platform";
import type {Transaction} from "../../storage/idb/Transaction";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

type SignatureMap = {
    [userId: string]: {[deviceIdAndAlgorithm: string]: string}
}

interface BaseBackupInfo {
    version: string,
    etag: string,
    count: number,
}

const Curve25519Algorithm = "m.megolm_backup.v1.curve25519-aes-sha2";

interface Curve25519BackupInfo extends BaseBackupInfo {
    algorithm: typeof Curve25519Algorithm,
    auth_data: Curve25519AuthData,
}

interface OtherBackupInfo extends BaseBackupInfo {
    algorithm: "other"
};

type BackupInfo = Curve25519BackupInfo | OtherBackupInfo;

interface Curve25519AuthData {
    public_key: string,
    signatures: SignatureMap
}

type AuthData = Curve25519AuthData;

export class SessionBackup {
    constructor(
        private readonly backupInfo: BackupInfo,
        private readonly decryption: Olm.PkDecryption,
        private readonly hsApi: HomeServerApi,
        private readonly keyLoader: KeyLoader
    ) {}

    async getSession(roomId: string, sessionId: string, log: ILogItem) {
        const sessionResponse = await this.hsApi.roomKeyForRoomAndSession(this.backupInfo.version, roomId, sessionId, {log}).response();
        const sessionInfo = this.decryption.decrypt(
            sessionResponse.session_data.ephemeral,
            sessionResponse.session_data.mac,
            sessionResponse.session_data.ciphertext,
        );
        return JSON.parse(sessionInfo);
    }

    get version() {
        return this.backupInfo.version;
    }

    dispose() {
        this.decryption.free();
    }

    static async fromSecretStorage(platform: Platform, olm: Olm, secretStorage: SecretStorage, hsApi: HomeServerApi, keyLoader: KeyLoader, txn: Transaction) {
        const base64PrivateKey = await secretStorage.readSecret("m.megolm_backup.v1", txn);
        if (base64PrivateKey) {
            const privateKey = new Uint8Array(platform.encoding.base64.decode(base64PrivateKey));
            const backupInfo = await hsApi.roomKeysVersion().response() as BackupInfo;
            if (backupInfo.algorithm === Curve25519Algorithm) {
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
                return new SessionBackup(backupInfo, decryption, hsApi, keyLoader);
            } else {
                throw new Error(`Unknown backup algorithm: ${backupInfo.algorithm}`);
            }
        }
    }
}

