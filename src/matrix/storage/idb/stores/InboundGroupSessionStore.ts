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

import {MIN_UNICODE, MAX_UNICODE} from "./common";
import {Store} from "../Store";

interface InboundGroupSession {
    roomId: string;
    senderKey: string;
    sessionId: string;
    session?: string;
    claimedKeys?: { [algorithm : string] : string };
    eventIds?: string[];
    key: string;
}

function encodeKey(roomId: string, senderKey: string, sessionId: string): string {
    return `${roomId}|${senderKey}|${sessionId}`;
}

export class InboundGroupSessionStore {
    private _store: Store<InboundGroupSession>;

    constructor(store: Store<InboundGroupSession>) {
        this._store = store;
    }

    async has(roomId: string, senderKey: string, sessionId: string): Promise<boolean> {
        const key = encodeKey(roomId, senderKey, sessionId);
        const fetchedKey = await this._store.getKey(key);
        return key === fetchedKey;
    }

    get(roomId: string, senderKey: string, sessionId: string): Promise<InboundGroupSession | null> {
        return this._store.get(encodeKey(roomId, senderKey, sessionId));
    }

    set(session: InboundGroupSession): void {
        session.key = encodeKey(session.roomId, session.senderKey, session.sessionId);
        this._store.put(session);
    }

    removeAllForRoom(roomId: string) {
        const range = this._store.IDBKeyRange.bound(
            encodeKey(roomId, MIN_UNICODE, MIN_UNICODE),
            encodeKey(roomId, MAX_UNICODE, MAX_UNICODE)
        );
        this._store.delete(range);
    }
}
