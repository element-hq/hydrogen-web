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

import type {InboundGroupSession} from "../../../storage/idb/stores/InboundGroupSessionStore";
import type {Transaction} from "../../../storage/idb/Transaction";
import type {DecryptionResult} from "../../DecryptionResult";

declare class OlmInboundGroupSession {
    constructor();
    free(): void;
    pickle(key: string | Uint8Array): string;
    unpickle(key: string | Uint8Array, pickle: string);
    create(session_key: string): string;
    import_session(session_key: string): string;
    decrypt(message: string): object;
    session_id(): string;
    first_known_index(): number;
    export_session(message_index: number): string;
}

export interface IRoomKey {
    get roomId(): string;
    get senderKey(): string;
    get sessionId(): string;
    get claimedEd25519Key(): string;
    get eventIds(): string[] | undefined;
    deserializeInto(session: OlmInboundGroupSession, pickleKey: string): void;
}

export interface IIncomingRoomKey extends IRoomKey {
    copyEventIds(value: string[]): void;
}

export async function checkBetterKeyInStorage(key: IIncomingRoomKey, keyDeserialization: KeyDeserialization, txn: Transaction) {
    let existingKey = keyDeserialization.cache.get(key.roomId, key.senderKey, key.sessionId);
    if (!existingKey) {
        const storageKey = await fromStorage(key.roomId, key.senderKey, key.sessionId, txn);
        // store the event ids that can be decrypted with this key
        // before we overwrite them if called from `write`.
        if (storageKey) {
            if (storageKey.eventIds) {
                key.copyEventIds(storageKey.eventIds);
            }
            if (storageKey.hasSession) {
                existingKey = storageKey;
            }
        }
    }
    if (existingKey) {
        const isBetter = await keyDeserialization.useKey(key, newSession => {
            return keyDeserialization.useKey(existingKey, existingSession => {
                return newSession.first_known_index() < existingSession.first_known_index();
            });
        });
        return isBetter ? key : existingKey;
    } else {
        return key;
    }
}

async function write(olm, pickleKey, keyDeserialization, txn) {
    // we checked already and we had a better session in storage, so don't write
    if (this._isBetter === false) {
        return false;
    }
    if (!this._sessionInfo) {
        await this.createSessionInfo(olm, pickleKey, txn);
    }
    if (this._sessionInfo) {
        // before calling write in parallel, we need to check keyDeserialization.running is false so we are sure our transaction will not be closed
        const pickledSession = await keyDeserialization.useKey(this, session => session.pickle(pickleKey));
        const sessionEntry = {
            roomId: this.roomId,
            senderKey: this.senderKey,
            sessionId: this.sessionId,
            session: pickledSession,
            claimedKeys: this._sessionInfo.claimedKeys,
        };
        txn.inboundGroupSessions.set(sessionEntry);
        this.dispose();
        return true;
    }
    return false;
}

class BaseIncomingRoomKey {
    private _eventIds?: string[];

    get eventIds() { return this._eventIds; }

    copyEventIds(eventIds: string[]): void {
        this._eventIds = eventIds;
    }
}

class DeviceMessageRoomKey extends BaseIncomingRoomKey implements IIncomingRoomKey {
    private _decryptionResult: DecryptionResult;

    constructor(decryptionResult: DecryptionResult) {
        super();
        this._decryptionResult = decryptionResult;
    }

    get roomId() { return this._decryptionResult.event.content?.["room_id"]; }
    get senderKey() { return this._decryptionResult.senderCurve25519Key; }
    get sessionId() { return this._decryptionResult.event.content?.["session_id"]; }
    get claimedEd25519Key() { return this._decryptionResult.claimedEd25519Key; }

    deserializeInto(session) {
        const sessionKey = this._decryptionResult.event.content?.["session_key"];
        session.create(sessionKey);
    }
}

class BackupRoomKey extends BaseIncomingRoomKey implements IIncomingRoomKey {
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

    deserializeInto(session) {
        const sessionKey = this._backupInfo["session_key"];
        session.import_session(sessionKey);
    }
}

class StoredRoomKey implements IRoomKey {
    private storageEntry: InboundGroupSession;

    constructor(storageEntry: InboundGroupSession) {
        this.storageEntry = storageEntry;
    }

    get roomId() { return this.storageEntry.roomId; }
    get senderKey() { return this.storageEntry.senderKey; }
    get sessionId() { return this.storageEntry.sessionId; }
    get claimedEd25519Key() { return this.storageEntry.claimedKeys!["ed25519"]; }
    get eventIds() { return this.storageEntry.eventIds; }

    deserializeInto(session, pickleKey) {
        session.unpickle(pickleKey, this.storageEntry.session);
    }

    get hasSession() {
        // sessions are stored before they are received
        // to keep track of events that need it to be decrypted.
        // This is used to retry decryption of those events once the session is received.
        return !!this.storageEntry.session;
    }
}

export function fromDeviceMessage(dr) {
    const roomId = dr.event.content?.["room_id"];
    const sessionId = dr.event.content?.["session_id"];
    const sessionKey = dr.event.content?.["session_key"];
    if (
        typeof roomId === "string" || 
        typeof sessionId === "string" || 
        typeof senderKey === "string" ||
        typeof sessionKey === "string"
    ) {
        return new DeviceMessageRoomKey(dr);
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
export function fromBackup(roomId, sessionId, sessionInfo) {
    const sessionKey = sessionInfo["session_key"];
    const senderKey = sessionInfo["sender_key"];
    // TODO: can we just trust this?
    const claimedEd25519Key = sessionInfo["sender_claimed_keys"]?.["ed25519"];

    if (
        typeof roomId === "string" && 
        typeof sessionId === "string" && 
        typeof senderKey === "string" &&
        typeof sessionKey === "string" &&
        typeof claimedEd25519Key === "string"
    ) {
        return new BackupRoomKey(roomId, sessionId, sessionInfo);
    }
}

export async function fromStorage(roomId: string, senderKey: string, sessionId: string, txn: Transaction): Promise<StoredRoomKey | undefined> {
    const existingSessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
    if (existingSessionEntry) {
        return new StoredRoomKey(existingSessionEntry);
    }
    return;
}
/*
Because Olm only has very limited memory available when compiled to wasm,
we limit the amount of sessions held in memory.
*/
class KeyDeserialization {

    public readonly cache: SessionCache;
    private pickleKey: string;
    private olm: any;
    private resolveUnusedEntry?: () => void;
    private entryBecomesUnusedPromise?: Promise<void>;

    constructor({olm, pickleKey, limit}) {
        this.cache = new SessionCache(limit);
        this.pickleKey = pickleKey;
        this.olm = olm;
    }

    async useKey<T>(key: IRoomKey, callback: (session: OlmInboundGroupSession) => Promise<T> | T): Promise<T> {
        const cacheEntry = await this.allocateEntry(key);
        try {
            const {session} = cacheEntry;
            key.deserializeInto(session, this.pickleKey);
            return await callback(session);
        } finally {
            this.freeEntry(cacheEntry);
        }
    }

    get running() {
        return !!this.cache.find(entry => entry.inUse);
    }

    private async allocateEntry(key): CacheEntry {
        let entry;
        if (this.cache.size >= MAX) {
            while(!(entry = this.cache.find(entry => !entry.inUse))) {
                await this.entryBecomesUnused();
            }
            entry.inUse = true;
            entry.key = key;
        } else {
            const session: OlmInboundGroupSession = new this.olm.InboundGroupSession();
            const entry = new CacheEntry(key, session);
            this.cache.add(entry);
        }
        return entry;
    }

    private freeEntry(entry) {
        entry.inUse = false;
        if (this.resolveUnusedEntry) {
            this.resolveUnusedEntry();
            // promise is resolved now, we'll need a new one for next await so clear
            this.entryBecomesUnusedPromise = this.resolveUnusedEntry = undefined;
        }
    }

    private entryBecomesUnused(): Promise<void> {
        if (!this.entryBecomesUnusedPromise) {
            this.entryBecomesUnusedPromise = new Promise(resolve => {
                this.resolveUnusedEntry = resolve;
            });
        }
        return this.entryBecomesUnusedPromise;
    }
}

class CacheEntry {
    inUse: boolean;
    session: OlmInboundGroupSession;
    key: IRoomKey;

    constructor(key, session) {
        this.key = key;
        this.session = session;
        this.inUse = true;
    }
}
