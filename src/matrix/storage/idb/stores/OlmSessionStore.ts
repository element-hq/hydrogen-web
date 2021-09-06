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
import {Store} from "../Store";

function encodeKey(senderKey: string, sessionId: string): string {
    return `${senderKey}|${sessionId}`;
}

function decodeKey(key: string): { senderKey: string, sessionId: string } {
    const [senderKey, sessionId] = key.split("|");
    return {senderKey, sessionId};
}

interface OlmSession {
    session: string;
    sessionId: string;
    senderKey: string;
    lastUsed: number;
}

type OlmSessionEntry = OlmSession & { key: string };

export class OlmSessionStore {
    private _store: Store<OlmSessionEntry>;

    constructor(store: Store<OlmSessionEntry>) {
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

    getAll(senderKey: string): Promise<OlmSession[]> {
        const range = this._store.IDBKeyRange.lowerBound(encodeKey(senderKey, ""));
        return this._store.selectWhile(range, session => {
            return session.senderKey === senderKey;
        });
    }

    get(senderKey: string, sessionId: string): Promise<OlmSession | null> {
        return this._store.get(encodeKey(senderKey, sessionId));
    }

    set(session: OlmSession): void {
        (session as OlmSessionEntry).key = encodeKey(session.senderKey, session.sessionId);
        this._store.put(session as OlmSessionEntry);
    }

    remove(senderKey: string, sessionId: string): Promise<undefined> {
        return this._store.delete(encodeKey(senderKey, sessionId));
    }
}
