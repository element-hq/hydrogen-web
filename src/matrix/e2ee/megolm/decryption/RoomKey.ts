/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import type {InboundGroupSessionEntry} from "../../../storage/idb/stores/InboundGroupSessionStore";
import type {Transaction} from "../../../storage/idb/Transaction";
import type {DecryptionResult} from "../../DecryptionResult";
import type {KeyLoader, OlmInboundGroupSession} from "./KeyLoader";

export interface IRoomKey {
    get roomId(): string;
    get senderKey(): string;
    get sessionId(): string;
    get claimedEd25519Key(): string;
    get serializationKey(): string;
    get serializationType(): string;
    get eventIds(): string[] | undefined;
    loadInto(session: OlmInboundGroupSession, pickleKey: string): void;
}

export function isBetterThan(newSession: OlmInboundGroupSession, existingSession: OlmInboundGroupSession) {
     return newSession.first_known_index() < existingSession.first_known_index();
}

export interface IIncomingRoomKey extends IRoomKey {
    get isBetter(): boolean | undefined;
    checkBetterThanKeyInStorage(loader: KeyLoader, txn: Transaction): Promise<boolean>;
    write(loader: KeyLoader, txn: Transaction): Promise<boolean>;
}

abstract class BaseIncomingRoomKey implements IIncomingRoomKey {
    private _eventIds?: string[];
    private _isBetter?: boolean;
    
    checkBetterThanKeyInStorage(loader: KeyLoader, txn: Transaction): Promise<boolean> {
        return this._checkBetterThanKeyInStorage(loader, undefined, txn);
    }

    async write(loader: KeyLoader, txn: Transaction): Promise<boolean> {
        // we checked already and we had a better session in storage, so don't write
        let pickledSession;
        if (this._isBetter === undefined) {
            // if this key wasn't used to decrypt any messages in the same sync,
            // we haven't checked if this is the best key yet,
            // so do that now to not overwrite a better key.
            // while we have the key deserialized, also pickle it to store it later on here.
            await this._checkBetterThanKeyInStorage(loader, (session, pickleKey) => {
                pickledSession = session.pickle(pickleKey);
            }, txn);
        }
        if (this._isBetter === false) {
            return false;
        }
        // before calling write in parallel, we need to check loader.running is false so we are sure our transaction will not be closed
        if (!pickledSession) {
            pickledSession = await loader.useKey(this, (session, pickleKey) => session.pickle(pickleKey));
        }
        const sessionEntry = {
            roomId: this.roomId,
            senderKey: this.senderKey,
            sessionId: this.sessionId,
            session: pickledSession,
            claimedKeys: {"ed25519": this.claimedEd25519Key},
        };
        txn.inboundGroupSessions.set(sessionEntry);
        return true;
    }

    get eventIds() { return this._eventIds; }
    get isBetter() { return this._isBetter; }

    private async _checkBetterThanKeyInStorage(loader: KeyLoader, callback: (((session: OlmInboundGroupSession, pickleKey: string) => void) | undefined), txn: Transaction): Promise<boolean> {
        if (this._isBetter !== undefined) {
            return this._isBetter;
        }
        let existingKey = loader.getCachedKey(this.roomId, this.senderKey, this.sessionId);
        if (!existingKey) {
            const storageKey = await keyFromStorage(this.roomId, this.senderKey, this.sessionId, txn);
            // store the event ids that can be decrypted with this key
            // before we overwrite them if called from `write`.
            if (storageKey) {
                if (storageKey.hasSession) {
                    existingKey = storageKey;
                } else if (storageKey.eventIds) {
                    this._eventIds = storageKey.eventIds;
                }
            }
        }
        if (existingKey) {
            const key = existingKey;
            this._isBetter = await loader.useKey(this, newSession => {
                return loader.useKey(key, (existingSession, pickleKey) => {
                    const isBetter = isBetterThan(newSession, existingSession);
                    if (isBetter && callback) {
                        callback(newSession, pickleKey);
                    }
                    return isBetter;
                });
            });
        } else {
            // no previous key, so we're the best \o/
            this._isBetter = true;
        }
        return this._isBetter!;
    }

    abstract get roomId(): string;
    abstract get senderKey(): string;
    abstract get sessionId(): string;
    abstract get claimedEd25519Key(): string;
    abstract get serializationKey(): string;
    abstract get serializationType(): string;
    abstract loadInto(session: OlmInboundGroupSession, pickleKey: string): void;
}

class DeviceMessageRoomKey extends BaseIncomingRoomKey {
    private _decryptionResult: DecryptionResult;

    constructor(decryptionResult: DecryptionResult) {
        super();
        this._decryptionResult = decryptionResult;
    }

    get roomId() { return this._decryptionResult.event.content?.["room_id"]; }
    get senderKey() { return this._decryptionResult.senderCurve25519Key; }
    get sessionId() { return this._decryptionResult.event.content?.["session_id"]; }
    get claimedEd25519Key() { return this._decryptionResult.claimedEd25519Key; }
    get serializationKey(): string { return this._decryptionResult.event.content?.["session_key"]; }
    get serializationType(): string { return "create"; }

    loadInto(session) {
        session.create(this.serializationKey);
    }
}

class BackupRoomKey extends BaseIncomingRoomKey {
    private _roomId: string;
    private _sessionId: string;
    private _backupInfo: string;

    constructor(roomId, sessionId, backupInfo) {
        super();
        this._roomId = roomId;
        this._sessionId = sessionId;
        this._backupInfo = backupInfo;
    }

    get roomId() { return this._roomId; }
    get senderKey() { return this._backupInfo["sender_key"]; }
    get sessionId() { return this._sessionId; }
    get claimedEd25519Key() { return this._backupInfo["sender_claimed_keys"]?.["ed25519"]; }
    get serializationKey(): string { return this._backupInfo["session_key"]; }
    get serializationType(): string { return "import_session"; }
    
    loadInto(session) {
        session.import_session(this.serializationKey);
    }
}

class StoredRoomKey implements IRoomKey {
    private storageEntry: InboundGroupSessionEntry;

    constructor(storageEntry: InboundGroupSessionEntry) {
        this.storageEntry = storageEntry;
    }

    get roomId() { return this.storageEntry.roomId; }
    get senderKey() { return this.storageEntry.senderKey; }
    get sessionId() { return this.storageEntry.sessionId; }
    get claimedEd25519Key() { return this.storageEntry.claimedKeys!["ed25519"]; }
    get eventIds() { return this.storageEntry.eventIds; }
    get serializationKey(): string { return this.storageEntry.session || ""; }
    get serializationType(): string { return "unpickle"; }
    
    loadInto(session, pickleKey) {
        session.unpickle(pickleKey, this.serializationKey);
    }

    get hasSession() {
        // sessions are stored before they are received
        // to keep track of events that need it to be decrypted.
        // This is used to retry decryption of those events once the session is received.
        return !!this.storageEntry.session;
    }
}

export function keyFromDeviceMessage(dr: DecryptionResult): DeviceMessageRoomKey | undefined {
    const sessionKey = dr.event.content?.["session_key"];
    const key = new DeviceMessageRoomKey(dr);
    if (
        typeof key.roomId === "string" && 
        typeof key.sessionId === "string" && 
        typeof key.senderKey === "string" &&
        typeof sessionKey === "string"
    ) {
        return key;
    }
}

/*
sessionInfo is a response from key backup and has the following keys:
    algorithm
    forwarding_curve25519_key_chain
    sender_claimed_keys
    sender_key
    session_key
 */
export function keyFromBackup(roomId, sessionId, backupInfo): BackupRoomKey | undefined {
    const sessionKey = backupInfo["session_key"];
    const senderKey = backupInfo["sender_key"];
    // TODO: can we just trust this?
    const claimedEd25519Key = backupInfo["sender_claimed_keys"]?.["ed25519"];

    if (
        typeof roomId === "string" && 
        typeof sessionId === "string" && 
        typeof senderKey === "string" &&
        typeof sessionKey === "string" &&
        typeof claimedEd25519Key === "string"
    ) {
        return new BackupRoomKey(roomId, sessionId, backupInfo);
    }
}

export async function keyFromStorage(roomId: string, senderKey: string, sessionId: string, txn: Transaction): Promise<StoredRoomKey | undefined> {
    const existingSessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
    if (existingSessionEntry) {
        return new StoredRoomKey(existingSessionEntry);
    }
    return;
}
