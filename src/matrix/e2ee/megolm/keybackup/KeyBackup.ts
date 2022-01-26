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

import {StoreNames} from "../../../storage/common";
import {keyFromStorage, keyFromBackup} from "../decryption/RoomKey";
import {MEGOLM_ALGORITHM} from "../../common";
import * as Curve25519 from "./Curve25519";

import type {HomeServerApi} from "../../../net/HomeServerApi";
import type {IncomingRoomKey, RoomKey} from "../decryption/RoomKey";
import type {KeyLoader} from "../decryption/KeyLoader";
import type {SecretStorage} from "../../../ssss/SecretStorage";
import type {Storage} from "../../../storage/idb/Storage";
import type {DeviceIdentity} from "../../../storage/idb/stores/DeviceIdentityStore";
import type {ILogItem} from "../../../../logging/types";
import type {Platform} from "../../../../platform/web/Platform";
import type {Transaction} from "../../../storage/idb/Transaction";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

export type SignatureMap = {
    [userId: string]: {[deviceIdAndAlgorithm: string]: string}
}

export type BaseBackupInfo = {
    version: string,
    etag: string,
    count: number,
}

type OtherBackupInfo = BaseBackupInfo & {
    algorithm: "other"
};

type BackupInfo = Curve25519.BackupInfo | OtherBackupInfo;
type AuthData = Curve25519.AuthData;

type SessionInfo = {
    first_message_index: number,
    forwarded_count: number,
    is_verified: boolean,
    session_data: Curve25519.SessionData | any
}

type MegOlmSessionKeyInfo = {
    algorithm: MEGOLM_ALGORITHM,
    sender_key: string,
    sender_claimed_keys: {[algorithm: string]: string},
    forwarding_curve25519_key_chain: string[],
    session_key: string
}

export type SessionKeyInfo = MegOlmSessionKeyInfo | {algorithm: string};

type KeyBackupPayload = {
    rooms: {
        [roomId: string]: {
            sessions: {[sessionId: string]: SessionInfo}
        }
    }
}

export class KeyBackup {
    constructor(
        private readonly backupInfo: BackupInfo,
        private readonly crypto: Curve25519.BackupEncryption,
        private readonly hsApi: HomeServerApi,
        private readonly keyLoader: KeyLoader,
        private readonly storage: Storage,
        private readonly platform: Platform,
    ) {}

    async getRoomKey(roomId: string, sessionId: string, log: ILogItem): Promise<IncomingRoomKey | undefined> {
        const sessionResponse = await this.hsApi.roomKeyForRoomAndSession(this.backupInfo.version, roomId, sessionId, {log}).response();
        if (!sessionResponse.session_data) {
            return;
        }
        const sessionKeyInfo = this.crypto.decryptRoomKey(sessionResponse.session_data as Curve25519.SessionData);
        if (sessionKeyInfo?.algorithm === MEGOLM_ALGORITHM) {
            return keyFromBackup(roomId, sessionId, sessionKeyInfo);
        } else if (sessionKeyInfo?.algorithm) {
            log.set("unknown algorithm", sessionKeyInfo.algorithm);
        }
    }

    writeKeys(roomKeys: IncomingRoomKey[], txn: Transaction): boolean {
        let hasBetter = false;
        for (const key of roomKeys) {
            if (key.isBetter) {
                txn.sessionsNeedingBackup.set(key.roomId, key.senderKey, key.sessionId);
                hasBetter = true;
            }
        }
        return hasBetter;
    }

    async flush() {
        while (true) {
            await this.platform.clock.createTimeout(this.platform.random() * 10000).elapsed();
            const txn = await this.storage.readTxn([
                StoreNames.sessionsNeedingBackup,
                StoreNames.inboundGroupSessions,
            ]);
            const keysNeedingBackup = await txn.sessionsNeedingBackup.getFirstEntries(20);
            if (keysNeedingBackup.length === 0) {
                return;
            }
            const roomKeys = await Promise.all(keysNeedingBackup.map(k => keyFromStorage(k.roomId, k.senderKey, k.sessionId, txn)));
            const payload: KeyBackupPayload = { rooms: {} };
            const payloadRooms = payload.rooms;
            for (const key of roomKeys) {
                if (key) {
                    let roomPayload = payloadRooms[key.roomId];
                    if (!roomPayload) {
                       roomPayload = payloadRooms[key.roomId] = { sessions: {} };
                    }
                    roomPayload.sessions[key.sessionId] = await this.encodeRoomKey(key);
                }
            }
            await this.hsApi.uploadRoomKeysToBackup(this.backupInfo.version, payload).response();
            {
                const txn = await this.storage.readWriteTxn([
                    StoreNames.sessionsNeedingBackup,
                ]);
                try {
                    for (const key of keysNeedingBackup) {
                        txn.sessionsNeedingBackup.remove(key.roomId, key.senderKey, key.sessionId);
                    }
                } catch (err) {
                    txn.abort();
                    throw err;
                }
                await txn.complete();
            }
        }
    }

    private async encodeRoomKey(roomKey: RoomKey): Promise<SessionInfo> {
        return await this.keyLoader.useKey(roomKey, session => {
            const firstMessageIndex = session.first_known_index();
            const sessionKey = session.export_session(firstMessageIndex);
            return {
                first_message_index: firstMessageIndex,
                forwarded_count: 0,
                is_verified: false,
                session_data: this.crypto.encryptRoomKey(roomKey, sessionKey)
            };
        });
    }

    get version(): string {
        return this.backupInfo.version;
    }

    dispose() {
        this.crypto.dispose();
    }

    static async fromSecretStorage(platform: Platform, olm: Olm, secretStorage: SecretStorage, hsApi: HomeServerApi, keyLoader: KeyLoader, storage: Storage, txn: Transaction): Promise<KeyBackup | undefined> {
        const base64PrivateKey = await secretStorage.readSecret("m.megolm_backup.v1", txn);
        if (base64PrivateKey) {
            const privateKey = new Uint8Array(platform.encoding.base64.decode(base64PrivateKey));
            const backupInfo = await hsApi.roomKeysVersion().response() as BackupInfo;
            if (backupInfo.algorithm === Curve25519.Algorithm) {
                const crypto = Curve25519.BackupEncryption.fromAuthData(backupInfo.auth_data, privateKey, olm);
                return new KeyBackup(backupInfo, crypto, hsApi, keyLoader, storage, platform);
            } else {
                throw new Error(`Unknown backup algorithm: ${backupInfo.algorithm}`);
            }
        }
    }
}
