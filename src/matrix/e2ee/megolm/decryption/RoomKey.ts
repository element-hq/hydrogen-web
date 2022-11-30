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

import {BackupStatus, KeySource} from "../../../storage/idb/stores/InboundGroupSessionStore";
import type {InboundGroupSessionEntry} from "../../../storage/idb/stores/InboundGroupSessionStore";
import type {Transaction} from "../../../storage/idb/Transaction";
import type {DecryptionResult} from "../../DecryptionResult";
import type {KeyLoader} from "./KeyLoader";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

export abstract class RoomKey {
    private _isBetter: boolean | undefined;

    isForSession(roomId: string, senderKey: string, sessionId: string) {
        return this.roomId === roomId && this.senderKey === senderKey && this.sessionId === sessionId;
    }

    abstract get roomId(): string;
    abstract get senderKey(): string;
    abstract get sessionId(): string;
    abstract get claimedEd25519Key(): string;
    abstract get serializationKey(): string;
    abstract get serializationType(): string;
    abstract get eventIds(): string[] | undefined;
    abstract loadInto(session: Olm.InboundGroupSession, pickleKey: string): void;
    /* Whether the key has been checked against storage (or is from storage)
     * to be the better key for a given session. Given that all keys are checked to be better
     * as part of writing, we can trust that when this returns true, it really is the best key
     * available between storage and cached keys in memory. This is why keys with this field set to
     * true are used by the key loader to return cached keys. Also see KeyOperation.isBest there. */
    get isBetter(): boolean | undefined { return this._isBetter; }
    // should only be set in key.checkBetterThanKeyInStorage
    set isBetter(value: boolean | undefined) { this._isBetter = value; }
}

export function isBetterThan(newSession: Olm.InboundGroupSession, existingSession: Olm.InboundGroupSession): boolean {
     return newSession.first_known_index() < existingSession.first_known_index();
}

export abstract class IncomingRoomKey extends RoomKey {
    private _eventIds?: string[];
    
    checkBetterThanKeyInStorage(loader: KeyLoader, txn: Transaction): Promise<boolean> {
        return this._checkBetterThanKeyInStorage(loader, undefined, txn);
    }

    async write(loader: KeyLoader, txn: Transaction): Promise<boolean> {
        // we checked already and we had a better session in storage, so don't write
        let pickledSession: string | undefined;
        if (this.isBetter === undefined) {
            // if this key wasn't used to decrypt any messages in the same sync,
            // we haven't checked if this is the best key yet,
            // so do that now to not overwrite a better key.
            // while we have the key deserialized, also pickle it to store it later on here.
            await this._checkBetterThanKeyInStorage(loader, (session, pickleKey) => {
                pickledSession = session.pickle(pickleKey);
            }, txn);
        }
        if (this.isBetter === false) {
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
            backup: this.backupStatus,
            source: this.keySource,
            claimedKeys: {"ed25519": this.claimedEd25519Key},
        };
        txn.inboundGroupSessions.set(sessionEntry);
        return true;
    }

    get eventIds(): string[] | undefined { return this._eventIds; }

    private async _checkBetterThanKeyInStorage(loader: KeyLoader, callback: (((session: Olm.InboundGroupSession, pickleKey: string) => void) | undefined), txn: Transaction): Promise<boolean> {
        if (this.isBetter !== undefined) {
            return this.isBetter;
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
            await loader.useKey(this, async newSession => {
                await loader.useKey(key, (existingSession, pickleKey) => {
                    // set isBetter as soon as possible, on both keys compared, 
                    // as it is is used to determine whether a key can be used for the cache
                    this.isBetter = isBetterThan(newSession, existingSession);
                    key.isBetter = !this.isBetter;
                    if (this.isBetter && callback) {
                        callback(newSession, pickleKey);
                    }
                });
            });
        } else {
            // no previous key, so we're the best \o/
            this.isBetter = true;
        }
        return this.isBetter!;
    }

    protected get backupStatus(): BackupStatus {
        return BackupStatus.NotBackedUp;
    }

    protected abstract get keySource(): KeySource;
}

class DeviceMessageRoomKey extends IncomingRoomKey {
    private _decryptionResult: DecryptionResult;

    constructor(decryptionResult: DecryptionResult) {
        super();
        this._decryptionResult = decryptionResult;
    }

    get roomId(): string { return this._decryptionResult.event.content?.["room_id"]; }
    get senderKey(): string { return this._decryptionResult.senderCurve25519Key; }
    get sessionId(): string { return this._decryptionResult.event.content?.["session_id"]; }
    get claimedEd25519Key(): string { return this._decryptionResult.claimedEd25519Key; }
    get serializationKey(): string { return this._decryptionResult.event.content?.["session_key"]; }
    get serializationType(): string { return "create"; }
    protected get keySource(): KeySource { return KeySource.DeviceMessage; }

    loadInto(session): void {
        session.create(this.serializationKey);
    }
}

// a room key we send out ourselves,
// here adapted to write it as an incoming key
// as we don't send it to ourself with a to_device msg
export class OutboundRoomKey extends IncomingRoomKey {
    private _sessionKey: string;

    constructor(
        private readonly _roomId: string,
        private readonly outboundSession: Olm.OutboundGroupSession,
        private readonly identityKeys: {[algo: string]: string}
    ) {
        super();
        // this is a new key, so always better than what might be in storage, no need to check
        this.isBetter = true;
        // cache this, as it is used by key loader to find a matching key and
        // this calls into WASM so is not just reading a prop
        this._sessionKey = this.outboundSession.session_key();
    }

    get roomId(): string { return this._roomId; }
    get senderKey(): string { return this.identityKeys.curve25519; }
    get sessionId(): string { return this.outboundSession.session_id(); }
    get claimedEd25519Key(): string { return this.identityKeys.ed25519; }
    get serializationKey(): string { return this._sessionKey; }
    get serializationType(): string { return "create"; }
    protected get keySource(): KeySource { return KeySource.Outbound; }

    loadInto(session: Olm.InboundGroupSession): void {
        session.create(this.serializationKey);
    }
}

class BackupRoomKey extends IncomingRoomKey {
    constructor(private _roomId: string, private _sessionId: string, private _backupInfo: object) {
        super();
    }

    get roomId(): void { return this._roomId; }
    get senderKey(): void { return this._backupInfo["sender_key"]; }
    get sessionId(): void { return this._sessionId; }
    get claimedEd25519Key(): void { return this._backupInfo["sender_claimed_keys"]?.["ed25519"]; }
    get serializationKey(): string { return this._backupInfo["session_key"]; }
    get serializationType(): string { return "import_session"; }
    protected get keySource(): KeySource { return KeySource.Backup; }

    loadInto(session): void {
        session.import_session(this.serializationKey);
    }

    protected get backupStatus(): BackupStatus {
        return BackupStatus.BackedUp;
    }
}

export class StoredRoomKey extends RoomKey {
    private storageEntry: InboundGroupSessionEntry;

    constructor(storageEntry: InboundGroupSessionEntry) {
        super();
        this.isBetter = true; // usually the key in storage is the best until checks prove otherwise
        this.storageEntry = storageEntry;
    }

    get roomId(): string { return this.storageEntry.roomId; }
    get senderKey(): string { return this.storageEntry.senderKey; }
    get sessionId(): string { return this.storageEntry.sessionId; }
    get claimedEd25519Key(): string { return this.storageEntry.claimedKeys!["ed25519"]; }
    get eventIds(): string[] | undefined { return this.storageEntry.eventIds; }
    get serializationKey(): string { return this.storageEntry.session || ""; }
    get serializationType(): string { return "unpickle"; }
    
    loadInto(session, pickleKey): void {
        session.unpickle(pickleKey, this.serializationKey);
    }

    get hasSession(): boolean {
        // sessions are stored before they are received
        // to keep track of events that need it to be decrypted.
        // This is used to retry decryption of those events once the session is received.
        return !!this.serializationKey;
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
export function keyFromBackup(roomId: string, sessionId: string, backupInfo: object): BackupRoomKey | undefined {
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
