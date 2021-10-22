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

import {IRoomKey, isBetterThan} from "./RoomKey";
import {BaseLRUCache} from "../../../../utils/LRUCache";


export declare class OlmDecryptionResult {
    readonly plaintext: string;
    readonly message_index: number;
}

export declare class OlmInboundGroupSession {
    constructor();
    free(): void;
    pickle(key: string | Uint8Array): string;
    unpickle(key: string | Uint8Array, pickle: string);
    create(session_key: string): string;
    import_session(session_key: string): string;
    decrypt(message: string): OlmDecryptionResult;
    session_id(): string;
    first_known_index(): number;
    export_session(message_index: number): string;
}

/*
Because Olm only has very limited memory available when compiled to wasm,
we limit the amount of sessions held in memory.
*/
export class KeyLoader extends BaseLRUCache<KeyOperation> {

    private pickleKey: string;
    private olm: any;
    private resolveUnusedOperation?: () => void;
    private operationBecomesUnusedPromise?: Promise<void>;

    constructor(olm: any, pickleKey: string, limit: number) {
        super(limit);
        this.pickleKey = pickleKey;
        this.olm = olm;
    }

    getCachedKey(roomId: string, senderKey: string, sessionId: string): IRoomKey | undefined {
        const idx = this.findIndexBestForSession(roomId, senderKey, sessionId);
        if (idx !== -1) {
            return this._getByIndexAndMoveUp(idx)!.key;
        }
    }

    async useKey<T>(key: IRoomKey, callback: (session: OlmInboundGroupSession, pickleKey: string) => Promise<T> | T): Promise<T> {
        const keyOp = await this.allocateOperation(key);
        try {
            return await callback(keyOp.session, this.pickleKey);
        } finally {
            this.releaseOperation(keyOp);
        }
    }

    get running() {
        return this._entries.some(op => op.refCount !== 0);
    }

    dispose() {
        for (let i = 0; i < this._entries.length; i += 1) {
            this._entries[i].dispose();
        }
        // remove all entries
        this._entries.splice(0, this._entries.length);
    }

    private async allocateOperation(key: IRoomKey): Promise<KeyOperation> {
        let idx;
        while((idx = this.findIndexForAllocation(key)) === -1) {
            await this.operationBecomesUnused();
        }
        if (idx < this.size) {
            const op = this._getByIndexAndMoveUp(idx)!;
            // cache hit
            if (op.isForKey(key)) {
                op.refCount += 1;
                return op;
            } else {
                // refCount should be 0 here
                op.refCount = 1;
                op.key = key;
                key.loadInto(op.session, this.pickleKey);
            }
            return op;
        } else {
            // create new operation
            const session = new this.olm.InboundGroupSession();
            key.loadInto(session, this.pickleKey);
            const op = new KeyOperation(key, session);
            this._set(op);
            return op;
        }
    }

    private releaseOperation(op: KeyOperation) {
        op.refCount -= 1;
        if (op.refCount <= 0 && this.resolveUnusedOperation) {
            this.resolveUnusedOperation();
            // promise is resolved now, we'll need a new one for next await so clear
            this.operationBecomesUnusedPromise = this.resolveUnusedOperation = undefined;
        }
    }

    private operationBecomesUnused(): Promise<void> {
        if (!this.operationBecomesUnusedPromise) {
            this.operationBecomesUnusedPromise = new Promise(resolve => {
                this.resolveUnusedOperation = resolve;
            });
        }
        return this.operationBecomesUnusedPromise;
    }

    private findIndexForAllocation(key: IRoomKey) {
        let idx = this.findIndexSameKey(key); // cache hit
        if (idx === -1) {
            idx = this.findIndexSameSessionUnused(key);
            if (idx === -1) {
                if (this.size < this.limit) {
                    idx = this.size;
                } else {
                    idx = this.findIndexOldestUnused();
                }
            }
        }
        return idx;
    }

    private findIndexBestForSession(roomId: string, senderKey: string, sessionId: string): number {
        return this._entries.reduce((bestIdx, op, i, arr) => {
            const bestOp = bestIdx === -1 ? undefined : arr[bestIdx];
            if (op.isForSameSession(roomId, senderKey, sessionId)) {
                if (!bestOp || op.isBetter(bestOp)) {
                    return i;
                }
            }
            return bestIdx;
        }, -1);
    }

    private findIndexSameKey(key: IRoomKey): number {
        return this._entries.findIndex(op => {
            return op.isForKey(key);
        });
    }

    private findIndexSameSessionUnused(key: IRoomKey): number {
        for (let i = this._entries.length - 1; i >= 0; i -= 1) {
            const op = this._entries[i];
            if (op.refCount === 0 && op.isForSameSession(key.roomId, key.senderKey, key.sessionId)) {
                return i;
            }
        }
        return -1;
    }

    private findIndexOldestUnused(): number {
        for (let i = this._entries.length - 1; i >= 0; i -= 1) {
            const op = this._entries[i];
            if (op.refCount === 0) {
                return i;
            }
        }
        return -1;
    }
}

class KeyOperation {
    session: OlmInboundGroupSession;
    key: IRoomKey;
    refCount: number;

    constructor(key: IRoomKey, session: OlmInboundGroupSession) {
        this.key = key;
        this.session = session;
        this.refCount = 1;
    }

    isForSameSession(roomId: string, senderKey: string, sessionId: string): boolean {
        return this.key.roomId === roomId && this.key.senderKey === senderKey && this.key.sessionId === sessionId;
    }

    // assumes isForSameSession is true
    isBetter(other: KeyOperation) {
        return isBetterThan(this.session, other.session);
    }

    isForKey(key: IRoomKey) {
        return this.key.serializationKey === key.serializationKey &&
            this.key.serializationType === key.serializationType;
    }

    dispose() {
        this.session.free();
    }
}
