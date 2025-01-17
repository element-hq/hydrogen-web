/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {Store} from "../Store";

function encodeKey(senderKey: string, sessionId: string): string {
    return `${senderKey}|${sessionId}`;
}

function decodeKey(key: string): { senderKey: string, sessionId: string } {
    const [senderKey, sessionId] = key.split("|");
    return {senderKey, sessionId};
}

export type OlmSessionEntry = {
    session: string;
    sessionId: string;
    senderKey: string;
    lastUsed: number;
}

type OlmSessionStoredEntry = OlmSessionEntry & { key: string };

export class OlmSessionStore {
    private _store: Store<OlmSessionStoredEntry>;

    constructor(store: Store<OlmSessionStoredEntry>) {
        this._store = store;
    }

    async getSessionIds(senderKey: string): Promise<string[]> {
        const sessionIds: string[] = [];
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(senderKey, ""));
        await this._store.iterateKeys(range, key => {
            const decodedKey = decodeKey(key as string);
            // prevent running into the next room
            if (decodedKey.senderKey === senderKey) {
                sessionIds.push(decodedKey.sessionId);
                return false;   // fetch more
            }
            return true; // done
        });
        return sessionIds;
    }

    getAll(senderKey: string): Promise<OlmSessionEntry[]> {
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(senderKey, ""));
        return this._store.selectWhile(range, session => {
            return session.senderKey === senderKey;
        });
    }

    get(senderKey: string, sessionId: string): Promise<OlmSessionEntry | undefined> {
        return this._store.get(encodeKey(senderKey, sessionId));
    }

    set(session: OlmSessionEntry): void {
        (session as OlmSessionStoredEntry).key = encodeKey(session.senderKey, session.sessionId);
        this._store.put(session as OlmSessionStoredEntry);
    }

    remove(senderKey: string, sessionId: string): void {
        this._store.delete(encodeKey(senderKey, sessionId));
    }
}
