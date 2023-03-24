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
import {ObservableValue} from "../../../../observable/value";
import {Deferred} from "../../../../utils/Deferred";
import {EventEmitter} from "../../../../utils/EventEmitter";

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
import type {IHomeServerRequest} from "../../../net/HomeServerRequest";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

const KEYS_PER_REQUEST = 200;

// a set of fields we need to store once we've fetched
// the backup info from the homeserver, which happens in start()
class BackupConfig {
    constructor(
        public readonly info: BackupInfo,
        public readonly crypto: Curve25519.BackupEncryption
    ) {}
}

export class KeyBackup extends EventEmitter<{change: never}> {
    private _operationInProgress?: AbortableOperation<Promise<void>, Progress>;
    private _stopped = false;
    private _needsNewKey = false;
    private _hasBackedUpAllKeys = false;
    private _error?: Error;
    private crypto?: Curve25519.BackupEncryption;
    private backupInfo?: BackupInfo;
    private privateKey?: Uint8Array;
    private backupConfigDeferred: Deferred<BackupConfig | undefined> = new Deferred();
    private backupInfoRequest?: IHomeServerRequest;

    constructor(
        private readonly hsApi: HomeServerApi,
        private readonly olm: Olm,
        private readonly keyLoader: KeyLoader,
        private readonly storage: Storage,
        private readonly platform: Platform,
        private readonly maxDelay: number = 10000
    ) {
        super();
        // doing the network request for getting the backup info
        // and hence creating the crypto instance depending on the chose algorithm
        // is delayed until start() is called, but we want to already take requests
        // for fetching the room keys, so put the crypto and backupInfo in a deferred.
        this.backupConfigDeferred = new Deferred();
    }

    get hasStopped(): boolean { return this._stopped; }
    get error(): Error | undefined { return this._error; }
    get version(): string | undefined { return this.backupConfigDeferred.value?.info?.version; }
    get needsNewKey(): boolean { return this._needsNewKey; }
    get hasBackedUpAllKeys(): boolean { return this._hasBackedUpAllKeys; }
    get operationInProgress(): AbortableOperation<Promise<void>, Progress> | undefined { return this._operationInProgress; }

    async getRoomKey(roomId: string, sessionId: string, log: ILogItem): Promise<IncomingRoomKey | undefined> {
        if (this.needsNewKey) {
            return;
        }
        const backupConfig = await this.backupConfigDeferred.promise;
        if (!backupConfig) {
            return;
        }
        const sessionResponse = await this.hsApi.roomKeyForRoomAndSession(backupConfig.info.version, roomId, sessionId, {log}).response();
        if (!sessionResponse.session_data) {
            return;
        }
        const sessionKeyInfo = backupConfig.crypto.decryptRoomKey(sessionResponse.session_data as SessionData);
        if (sessionKeyInfo?.algorithm === MEGOLM_ALGORITHM) {
            return keyFromBackup(roomId, sessionId, sessionKeyInfo);
        } else if (sessionKeyInfo?.algorithm) {
            log.set("unknown algorithm", sessionKeyInfo.algorithm);
        }
    }

    markAllForBackup(txn: Transaction): Promise<number> {
        return txn.inboundGroupSessions.markAllAsNotBackedUp();
    }

    async load(secretStorage: SecretStorage, log: ILogItem) {
        const base64PrivateKey = await secretStorage.readSecret("m.megolm_backup.v1");
        if (base64PrivateKey) {
            this.privateKey = new Uint8Array(this.platform.encoding.base64.decode(base64PrivateKey));
            return true;
        } else {
            this.backupConfigDeferred.resolve(undefined);
            return false;
        }
    }

    async start(log: ILogItem) {
        await log.wrap("KeyBackup.start", async log => {
            if (this.privateKey && !this.backupInfoRequest) {
                let backupInfo: BackupInfo;
                try {
                    this.backupInfoRequest = this.hsApi.roomKeysVersion(undefined, {log});
                    backupInfo = await this.backupInfoRequest.response() as BackupInfo;
                } catch (err) {
                    if (err.name === "AbortError") {
                        log.set("aborted", true);
                        return;
                    } else {
                        throw err;
                    }
                } finally {
                    this.backupInfoRequest = undefined;
                }
                // TODO: what if backupInfo is undefined or we get 404 or something?
                if (backupInfo.algorithm === Curve25519.Algorithm) {
                    const crypto = Curve25519.BackupEncryption.fromAuthData(backupInfo.auth_data, this.privateKey, this.olm);
                    this.backupConfigDeferred.resolve(new BackupConfig(backupInfo, crypto));
                    this.emit("change");
                } else {
                    this.backupConfigDeferred.resolve(undefined);
                    log.log({l: `Unknown backup algorithm`, algorithm: backupInfo.algorithm});
                }
                this.privateKey = undefined;
            }
            // fetch latest version
            this.flush(log);
        });
    }

    flush(log: ILogItem): void {
        if (!this._operationInProgress) {
            log.wrapDetached("flush key backup", async log => {
                if (this._needsNewKey) {
                    log.set("needsNewKey", this._needsNewKey);
                    return;
                }
                this._stopped = false;
                this._error = undefined;
                this._hasBackedUpAllKeys = false;
                const operation = this._runFlushOperation(log);
                this._operationInProgress = operation;
                this.emit("change");
                try {
                    await operation.result;
                    this._hasBackedUpAllKeys = true;
                } catch (err) {
                    this._stopped = true;
                    if (err.name === "HomeServerError" && (err.errcode === "M_WRONG_ROOM_KEYS_VERSION" || err.errcode === "M_NOT_FOUND")) {
                        log.set("wrong_version", true);
                        this._needsNewKey = true;
                    } else {
                        // TODO should really also use AbortError in storage
                        if (err.name !== "AbortError" || (err.name === "StorageError" && err.errcode === "AbortError")) {
                            this._error = err;
                        }
                    }
                    log.catch(err);
                }
                this._operationInProgress = undefined;
                this.emit("change");
            });
        }
    }

    private _runFlushOperation(log: ILogItem): AbortableOperation<Promise<void>, Progress> {
        return new AbortableOperation(async (setAbortable, setProgress) => {
            const backupConfig = await this.backupConfigDeferred.promise;
            if (!backupConfig) {
                return;
            }
            let total = 0;
            let amountFinished = 0;
            while (true) {
                const waitMs = this.platform.random() * this.maxDelay;
                const timeout = this.platform.clock.createTimeout(waitMs);
                setAbortable(timeout);
                await timeout.elapsed();
                const txn = await this.storage.readTxn([StoreNames.inboundGroupSessions]);
                setAbortable(txn);
                // fetch total again on each iteration as while we are flushing, sync might be adding keys
                total = amountFinished + await txn.inboundGroupSessions.countNonBackedUpSessions();
                setProgress(new Progress(total, amountFinished));
                const keysNeedingBackup = (await txn.inboundGroupSessions.getFirstNonBackedUpSessions(KEYS_PER_REQUEST))
                    .map(entry => new StoredRoomKey(entry));
                if (keysNeedingBackup.length === 0) {
                    log.set("total", total);
                    return;
                }
                const payload = await this.encodeKeysForBackup(keysNeedingBackup, backupConfig.crypto);
                const uploadRequest = this.hsApi.uploadRoomKeysToBackup(backupConfig.info.version, payload, {log});
                setAbortable(uploadRequest);
                await uploadRequest.response();
                await this.markKeysAsBackedUp(keysNeedingBackup, setAbortable);
                amountFinished += keysNeedingBackup.length;
                setProgress(new Progress(total, amountFinished));
            }
        });
    }

    private async encodeKeysForBackup(roomKeys: RoomKey[], crypto: Curve25519.BackupEncryption): Promise<KeyBackupPayload> {
        const payload: KeyBackupPayload = { rooms: {} };
        const payloadRooms = payload.rooms;
        for (const key of roomKeys) {
            let roomPayload = payloadRooms[key.roomId];
            if (!roomPayload) {
               roomPayload = payloadRooms[key.roomId] = { sessions: {} };
            }
            roomPayload.sessions[key.sessionId] = await this.encodeRoomKey(key, crypto);
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

    private async encodeRoomKey(roomKey: RoomKey, crypto: Curve25519.BackupEncryption): Promise<SessionInfo> {
        return await this.keyLoader.useKey(roomKey, session => {
            const firstMessageIndex = session.first_known_index();
            const sessionKey = session.export_session(firstMessageIndex);
            return {
                first_message_index: firstMessageIndex,
                forwarded_count: 0,
                is_verified: false,
                session_data: crypto.encryptRoomKey(roomKey, sessionKey)
            };
        });
    }

    dispose() {
        this.backupInfoRequest?.abort();
        this.backupConfigDeferred.value?.crypto?.dispose();
    }
}

export class Progress {
    constructor(
        public readonly total: number,
        public readonly finished: number
    ) {}
}
