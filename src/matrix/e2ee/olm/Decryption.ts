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

import {DecryptionError} from "../common";
import {groupBy} from "../../../utils/groupBy";
import {MultiLock, ILock} from "../../../utils/Lock";
import {Session} from "./Session";
import {DecryptionResult} from "../DecryptionResult";
import {OlmPayloadType} from "./types";

import type {OlmMessage, OlmPayload} from "./types";
import type {Account} from "../Account";
import type {LockMap} from "../../../utils/LockMap";
import type {Transaction} from "../../storage/idb/Transaction";
import type {OlmEncryptedEvent} from "./types";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

const SESSION_LIMIT_PER_SENDER_KEY = 4;

type DecryptionResults = {
    results: DecryptionResult[],
    errors: DecryptionError[],
    senderKeyDecryption: SenderKeyDecryption
};

type CreateAndDecryptResult = {
    session: Session,
    plaintext: string
};

function sortSessions(sessions: Session[]): void {
    sessions.sort((a, b) => {
        return b.data.lastUsed - a.data.lastUsed;
    });
}

export class Decryption {
    constructor(
        private readonly account: Account,
        private readonly pickleKey: string,
        private readonly now: () => number,
        private readonly ownUserId: string,
        private readonly olm: Olm,
        private readonly senderKeyLock: LockMap<string>
    ) {}
    
    // we need to lock because both encryption and decryption can't be done in one txn,
    // so for them not to step on each other toes, we need to lock.
    // 
    // the lock is release from 1 of 3 places, whichever comes first:
    //  - decryptAll below fails (to release the lock as early as we can)
    //  - DecryptionChanges.write succeeds
    //  - Sync finishes the writeSync phase (or an error was thrown, in case we never get to DecryptionChanges.write) 
    async obtainDecryptionLock(events: OlmEncryptedEvent[]): Promise<ILock> {
        const senderKeys = new Set<string>();
        for (const event of events) {
            const senderKey = event.content?.["sender_key"];
            if (senderKey) {
                senderKeys.add(senderKey);
            }
        }
        // take a lock on all senderKeys so encryption or other calls to decryptAll (should not happen)
        // don't modify the sessions at the same time
        const locks = await Promise.all(Array.from(senderKeys).map(senderKey => {
            return this.senderKeyLock.takeLock(senderKey);
        }));
        return new MultiLock(locks);
    }

    // we need decryptAll because there is some parallelization we can do for decrypting different sender keys at once
    // but for the same sender key we need to do one by one
    // 
    // also we want to store the room key, etc ... in the same txn as we remove the pending encrypted event
    // 
    // so we need to decrypt events in a batch (so we can decide which ones can run in parallel and which one one by one)
    // and also can avoid side-effects before all can be stored this way
    // 
    // doing it one by one would be possible, but we would lose the opportunity for parallelization
    // 
    
    /**
     * It is importants the lock obtained from obtainDecryptionLock is for the same set of events as passed in here.
     * [decryptAll description]
     * @param  {[type]} events
     * @return {Promise<DecryptionChanges>}        [description]
     */
    async decryptAll(events: OlmEncryptedEvent[], lock: ILock, txn: Transaction): Promise<DecryptionChanges> {
        try {
            const eventsPerSenderKey = groupBy(events, (event: OlmEncryptedEvent) => event.content?.["sender_key"]);
            const timestamp = this.now();
            // decrypt events for different sender keys in parallel
            const senderKeyOperations = await Promise.all(Array.from(eventsPerSenderKey.entries()).map(([senderKey, events]) => {
                return this._decryptAllForSenderKey(senderKey!, events, timestamp, txn);
            }));
            const results = senderKeyOperations.reduce((all, r) => all.concat(r.results), [] as DecryptionResult[]);
            const errors = senderKeyOperations.reduce((all, r) => all.concat(r.errors), [] as DecryptionError[]);
            const senderKeyDecryptions = senderKeyOperations.map(r => r.senderKeyDecryption);
            return new DecryptionChanges(senderKeyDecryptions, results, errors, this.account, lock);
        } catch (err) {
            // make sure the locks are release if something throws
            // otherwise they will be released in DecryptionChanges after having written
            // or after the writeSync phase in Sync
            lock.release();
            throw err;
        }
    }

    async _decryptAllForSenderKey(senderKey: string, events: OlmEncryptedEvent[], timestamp: number, readSessionsTxn: Transaction): Promise<DecryptionResults> {
        const sessions = await this._getSessions(senderKey, readSessionsTxn);
        const senderKeyDecryption = new SenderKeyDecryption(senderKey, sessions, timestamp);
        const results: DecryptionResult[] = [];
        const errors: DecryptionError[] = [];
        // events for a single senderKey need to be decrypted one by one
        for (const event of events) {
            try {
                const result = this._decryptForSenderKey(senderKeyDecryption, event, timestamp);
                results.push(result);
            } catch (err) {
                errors.push(err);
            }
        }
        return {results, errors, senderKeyDecryption};
    }

    _decryptForSenderKey(senderKeyDecryption: SenderKeyDecryption, event: OlmEncryptedEvent, timestamp: number): DecryptionResult {
        const senderKey = senderKeyDecryption.senderKey;
        const message = this._getMessageAndValidateEvent(event);
        let plaintext: string | undefined;
        try {
            plaintext = senderKeyDecryption.decrypt(message);
        } catch (err) {
            // TODO: is it ok that an error on one session prevents other sessions from being attempted?
            throw new DecryptionError("OLM_BAD_ENCRYPTED_MESSAGE", event, {senderKey, error: err.message});
        }
        // could not decrypt with any existing session
        if (typeof plaintext !== "string" && message.type === OlmPayloadType.PreKey) {
            let createResult: CreateAndDecryptResult;
            try {
                createResult = this._createSessionAndDecrypt(senderKey, message, timestamp);
            } catch (error) {
                throw new DecryptionError(`Could not create inbound olm session: ${error.message}`, event, {senderKey, error});
            }
            senderKeyDecryption.addNewSession(createResult.session);
            plaintext = createResult.plaintext;
        }
        if (typeof plaintext === "string") {
            let payload: OlmPayload;
            try {
                payload = JSON.parse(plaintext);
            } catch (error) {
                throw new DecryptionError("PLAINTEXT_NOT_JSON", event, {plaintext, error});
            }
            this._validatePayload(payload, event);
            return new DecryptionResult(payload, senderKey, payload.keys!.ed25519!);
        } else {
            throw new DecryptionError("OLM_NO_MATCHING_SESSION", event,
                {knownSessionIds: senderKeyDecryption.sessions.map(s => s.id)});
        }
    }

    // only for pre-key messages after having attempted decryption with existing sessions
    _createSessionAndDecrypt(senderKey: string, message: OlmMessage, timestamp: number): CreateAndDecryptResult {
        let plaintext;
        // if we have multiple messages encrypted with the same new session,
        // this could create multiple sessions as the OTK isn't removed yet
        // (this only happens in DecryptionChanges.write)
        // This should be ok though as we'll first try to decrypt with the new session
        const olmSession = this.account.createInboundOlmSession(senderKey, message.body);
        try {
            plaintext = olmSession.decrypt(message.type, message.body);
            const session = Session.create(senderKey, olmSession, this.olm, this.pickleKey, timestamp);
            session.unload(olmSession);
            return {session, plaintext};
        } catch (err) {
            olmSession.free();
            throw err;
        }
    }

    _getMessageAndValidateEvent(event: OlmEncryptedEvent): OlmMessage {
        const ciphertext = event.content?.ciphertext;
        if (!ciphertext) {
            throw new DecryptionError("OLM_MISSING_CIPHERTEXT", event);
        }
        const message = ciphertext?.[this.account.identityKeys.curve25519];
        if (!message) {
            throw new DecryptionError("OLM_NOT_INCLUDED_IN_RECIPIENTS", event);
        }

        return message;
    }

    async _getSessions(senderKey: string, txn: Transaction): Promise<Session[]> {
        const sessionEntries = await txn.olmSessions.getAll(senderKey);
        // sort most recent used sessions first
        const sessions = sessionEntries.map(s => new Session(s, this.pickleKey, this.olm));
        sortSessions(sessions);
        return sessions;
    }

    _validatePayload(payload: OlmPayload, event: OlmEncryptedEvent): void {
        if (payload.sender !== event.sender) {
            throw new DecryptionError("OLM_FORWARDED_MESSAGE", event, {sentBy: event.sender, encryptedBy: payload.sender});
        }
        if (payload.recipient !== this.ownUserId) {
            throw new DecryptionError("OLM_BAD_RECIPIENT", event, {recipient: payload.recipient});
        }
        if (payload.recipient_keys?.ed25519 !== this.account.identityKeys.ed25519) {
            throw new DecryptionError("OLM_BAD_RECIPIENT_KEY", event, {key: payload.recipient_keys?.ed25519});
        }
        // TODO: check room_id
        if (!payload.type) {
            throw new DecryptionError("missing type on payload", event, {payload});
        }
        if (typeof payload.keys?.ed25519 !== "string") {
            throw new DecryptionError("Missing or invalid claimed ed25519 key on payload", event, {payload});
        }
    }
}

// decryption helper for a single senderKey
class SenderKeyDecryption {
    constructor(
        public readonly senderKey: string,
        public readonly sessions: Session[],
        private readonly timestamp: number
    ) {}

    addNewSession(session: Session): void {
        // add at top as it is most recent
        this.sessions.unshift(session);
    }

    decrypt(message: OlmMessage): string | undefined {
        for (const session of this.sessions) {
            const plaintext = this.decryptWithSession(session, message);
            if (typeof plaintext === "string") {
                // keep them sorted so will try the same session first for other messages
                // and so we can assume the excess ones are at the end
                // if they grow too large
                sortSessions(this.sessions);
                return plaintext;
            }
        }
    }

    getModifiedSessions(): Session[] {
        return this.sessions.filter(session => session.isModified);
    }

    get hasNewSessions(): boolean {
        return this.sessions.some(session => session.isNew);
    }

    // this could internally dispatch to a web-worker
    // and is why we unpickle/pickle on each iteration
    // if this turns out to be a real cost for IE11,
    // we could look into adding a less expensive serialization mechanism
    // for olm sessions to libolm
    private decryptWithSession(session: Session, message: OlmMessage): string | undefined {
        if (message.type === undefined || message.body === undefined) {
            throw new Error("Invalid message without type or body");
        }
        const olmSession = session.load();
        try {
            if (message.type === OlmPayloadType.PreKey && !olmSession.matches_inbound(message.body)) {
                return;
            }
            try {
                const plaintext = olmSession.decrypt(message.type as number, message.body!);
                session.save(olmSession);
                session.data.lastUsed = this.timestamp;
                return plaintext;
            } catch (err) {
                if (message.type === OlmPayloadType.PreKey) {
                    throw new Error(`Error decrypting prekey message with existing session id ${session.id}: ${err.message}`);
                }
                // decryption failed, bail out
                return;
            }
        } finally {
            session.unload(olmSession);
        }
    }
}

/**
 * @property {Array<DecryptionResult>} results
 * @property {Array<DecryptionError>} errors  see DecryptionError.event to retrieve the event that failed to decrypt.
 */
class DecryptionChanges {
    constructor(
        private readonly senderKeyDecryptions: SenderKeyDecryption[],
        public readonly results: DecryptionResult[],
        public readonly errors: DecryptionError[],
        private readonly account: Account,
        private readonly lock: ILock
    ) {}

    get hasNewSessions(): boolean {
        return this.senderKeyDecryptions.some(skd => skd.hasNewSessions);
    }

    write(txn: Transaction): void {
        try {
            for (const senderKeyDecryption of this.senderKeyDecryptions) {
                for (const session of senderKeyDecryption.getModifiedSessions()) {
                    txn.olmSessions.set(session.data);
                    if (session.isNew) {
                        const olmSession = session.load();
                        try {
                            this.account.writeRemoveOneTimeKey(olmSession, txn);
                        } finally {
                            session.unload(olmSession);
                        }
                    }
                }
                if (senderKeyDecryption.sessions.length > SESSION_LIMIT_PER_SENDER_KEY) {
                    const {senderKey, sessions} = senderKeyDecryption;
                    // >= because index is zero-based
                    for (let i = sessions.length - 1; i >= SESSION_LIMIT_PER_SENDER_KEY ; i -= 1) {
                        const session = sessions[i];
                        txn.olmSessions.remove(senderKey, session.id);
                    }
                }
            }
        } finally {
            this.lock.release();
        }
    }
}
