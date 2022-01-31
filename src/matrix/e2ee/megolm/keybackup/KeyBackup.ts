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
import {StoredRoomKey, keyFromBackup} from "../decryption/RoomKey";
import {MEGOLM_ALGORITHM} from "../../common";
import * as Curve25519 from "./Curve25519";
import {AbortableOperation} from "../../../../utils/AbortableOperation";
import {ObservableValue} from "../../../../observable/ObservableValue";

import {SetAbortableFn} from "../../../../utils/AbortableOperation";
import type {BackupInfo, SessionData, SessionKeyInfo, SessionInfo, KeyBackupPayload} from "./types";
import type {HomeServerApi} from "../../../net/HomeServerApi";
import type {IncomingRoomKey, RoomKey} from "../decryption/RoomKey";
import type {KeyLoader} from "../decryption/KeyLoader";
import type {SecretStorage} from "../../../ssss/SecretStorage";
import type {Storage} from "../../../storage/idb/Storage";
import type {ILogItem} from "../../../../logging/types";
import type {Platform} from "../../../../platform/web/Platform";
import type {Transaction} from "../../../storage/idb/Transaction";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

const KEYS_PER_REQUEST = 20;

export class KeyBackup {
    public readonly operationInProgress = new ObservableValue<AbortableOperation<Promise<boolean>, Progress> | undefined>(undefined);
    public readonly needsNewKey = new ObservableValue(false);

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
        const sessionKeyInfo = this.crypto.decryptRoomKey(sessionResponse.session_data as SessionData);
        if (sessionKeyInfo?.algorithm === MEGOLM_ALGORITHM) {
            return keyFromBackup(roomId, sessionId, sessionKeyInfo);
        } else if (sessionKeyInfo?.algorithm) {
            log.set("unknown algorithm", sessionKeyInfo.algorithm);
        }
    }

    markAllForBackup(txn: Transaction): Promise<number> {
        return txn.inboundGroupSessions.markAllAsNotBackedUp();
    }

    flush(log: ILogItem): void {
        if (!this.operationInProgress.get()) {
            log.wrapDetached("flush key backup", async log => {
                const operation = this._flush(log);
                this.operationInProgress.set(operation);
                try {
                    const success = await operation.result;
                    // stop key backup if the version was changed
                    if (!success) {
                        this.needsNewKey.set(true);
                    }
                } catch (err) {
                    log.catch(err);
                }
                this.operationInProgress.set(undefined);
            });
        }
    }

    private _flush(log: ILogItem): AbortableOperation<Promise<boolean>, Progress> {
        return new AbortableOperation(async (setAbortable, setProgress) => {
            let total = 0;
            let amountFinished = 0;
            while (true) {
                const waitMs = this.platform.random() * 10000;
                const timeout = this.platform.clock.createTimeout(waitMs);
                setAbortable(timeout);
                await timeout.elapsed();
                const txn = await this.storage.readTxn([StoreNames.inboundGroupSessions]);
                setAbortable(txn);
                // fetch total again on each iteration as while we are flushing, sync might be adding keys
                total = await txn.inboundGroupSessions.countNonBackedUpSessions();
                setProgress(new Progress(total, amountFinished));
                const keysNeedingBackup = (await txn.inboundGroupSessions.getFirstNonBackedUpSessions(KEYS_PER_REQUEST))
                    .map(entry => new StoredRoomKey(entry));
                if (keysNeedingBackup.length === 0) {
                    return true;
                }
                const payload = await this.encodeKeysForBackup(keysNeedingBackup);
                const uploadRequest = this.hsApi.uploadRoomKeysToBackup(this.backupInfo.version, payload, {log});
                setAbortable(uploadRequest);
                try {
                    await uploadRequest.response();
                } catch (err) {
                    if (err.name === "HomeServerError" && err.errcode === "M_WRONG_ROOM_KEYS_VERSION") {
                        log.set("wrong_version", true);
                        return false;
                    } else {
                        throw err;
                    }
                }
                await this.markKeysAsBackedUp(keysNeedingBackup, setAbortable);
                amountFinished += keysNeedingBackup.length;
                setProgress(new Progress(total, amountFinished));
            }
        });
    }

    private async encodeKeysForBackup(roomKeys: RoomKey[]): Promise<KeyBackupPayload> {
        const payload: KeyBackupPayload = { rooms: {} };
        const payloadRooms = payload.rooms;
        for (const key of roomKeys) {
            let roomPayload = payloadRooms[key.roomId];
            if (!roomPayload) {
               roomPayload = payloadRooms[key.roomId] = { sessions: {} };
            }
            roomPayload.sessions[key.sessionId] = await this.encodeRoomKey(key);
        }
        return payload;
    }

    private async markKeysAsBackedUp(roomKeys: RoomKey[], setAbortable: SetAbortableFn) {
        const txn = await this.storage.readWriteTxn([
            StoreNames.inboundGroupSessions,
        ]);
        setAbortable(txn);
        try {
            await Promise.all(roomKeys.map(key => {
                return txn.inboundGroupSessions.markAsBackedUp(key.roomId, key.senderKey, key.sessionId);
            }));
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
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

export class Progress {
    constructor(
        public readonly total: number,
        public readonly finished: number
    ) {}
}
