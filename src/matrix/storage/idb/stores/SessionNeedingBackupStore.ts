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

import type {Store} from "../Store";

export type BackupEntry = {
    roomId: string;
    senderKey: string;
    sessionId: string;
};

type StorageEntry = {
    key: string
};

export function encodeKey(roomId: string, senderKey: string, sessionId: string): string {
    return `${roomId}|${senderKey}|${sessionId}`;
}

function decodeKey(key: string): BackupEntry {
    const [roomId, senderKey, sessionId] = key.split("|");
    return {roomId, senderKey, sessionId};
}

export class SessionNeedingBackupStore {
    constructor(private store: Store<StorageEntry>) {}

    async getFirstEntries(amount: number): Promise<BackupEntry[]> {
        const storageEntries = await this.store.selectLimit(undefined, amount);
        return storageEntries.map(s => decodeKey(s.key));
    }

    set(roomId: string, senderKey: string, sessionId: string): void {
        const storageEntry : StorageEntry = {
            key: encodeKey(roomId, senderKey, sessionId),
        };
        this.store.put(storageEntry);
    }
    
    remove(roomId: string, senderKey: string, sessionId: string): void {
        this.store.delete(encodeKey(roomId, senderKey, sessionId));
    }

    count(): Promise<number> {
        return this.store.count();
    }
}
