/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {MEGOLM_ALGORITHM} from "../../common";
import type {RoomKey} from "../decryption/RoomKey";

import type {BaseBackupInfo, SignatureMap, SessionKeyInfo} from "./types";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

export const Algorithm = "m.megolm_backup.v1.curve25519-aes-sha2";

export type BackupInfo = BaseBackupInfo & {
    algorithm: typeof Algorithm,
    auth_data: AuthData,
}

type AuthData = {
    public_key: string,
    signatures: SignatureMap
}

export type SessionData = {
    ciphertext: string,
    mac: string,
    ephemeral: string,
}

export class BackupEncryption {
    constructor(
        private encryption?: Olm.PkEncryption,
        private decryption?: Olm.PkDecryption
    ) {}

    static fromAuthData(authData: AuthData, privateKey: Uint8Array, olm: Olm): BackupEncryption {
        const expectedPubKey = authData.public_key;
        const decryption = new olm.PkDecryption();
        const encryption = new olm.PkEncryption();
        try {
            const pubKey = decryption.init_with_private_key(privateKey);
            if (pubKey !== expectedPubKey) {
                throw new Error(`Bad backup key, public key does not match. Calculated ${pubKey} but expected ${expectedPubKey}`);
            }
            encryption.set_recipient_key(pubKey);
        } catch(err) {
            decryption.free();
            encryption.free();
            throw err;
        }
        return new BackupEncryption(encryption, decryption);
    }

    decryptRoomKey(sessionData: SessionData): SessionKeyInfo {
        const sessionInfo = this.decryption!.decrypt(
            sessionData.ephemeral,
            sessionData.mac,
            sessionData.ciphertext,
        );
        return JSON.parse(sessionInfo) as SessionKeyInfo;
    }

    encryptRoomKey(key: RoomKey, sessionKey: string): SessionData {
        const sessionInfo: SessionKeyInfo = {
            algorithm: MEGOLM_ALGORITHM,
            sender_key: key.senderKey,
            sender_claimed_keys: {ed25519: key.claimedEd25519Key},
            forwarding_curve25519_key_chain: [],
            session_key: sessionKey
        };
        return this.encryption!.encrypt(JSON.stringify(sessionInfo)) as SessionData;
    }

    dispose() {
        this.decryption?.free();
        this.decryption = undefined;
        this.encryption?.free();
        this.encryption = undefined;
    }
}
