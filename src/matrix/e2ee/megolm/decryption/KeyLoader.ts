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
            return op.isForSameSession(key.roomId, key.senderKey, key.sessionId) && op.isForKey(key);
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

export function tests() {
    let instances = 0;

    class MockRoomKey implements IRoomKey {
        private _roomId: string;
        private _senderKey: string;
        private _sessionId: string;
        private _firstKnownIndex: number;

        constructor(roomId: string, senderKey: string, sessionId: string, firstKnownIndex: number) {
            this._roomId = roomId;
            this._senderKey = senderKey;
            this._sessionId = sessionId;
            this._firstKnownIndex = firstKnownIndex;
        }

        get roomId(): string { return this._roomId; }
        get senderKey(): string { return this._senderKey; }
        get sessionId(): string { return this._sessionId; }
        get claimedEd25519Key(): string { return "claimedEd25519Key"; }
        get serializationKey(): string { return `key-${this.sessionId}-${this._firstKnownIndex}`; }
        get serializationType(): string { return "type"; }
        get eventIds(): string[] | undefined { return undefined; }
        loadInto(session: OlmInboundGroupSession) {
            const mockSession = session as MockInboundSession;
            mockSession.sessionId = this.sessionId;
            mockSession.firstKnownIndex = this._firstKnownIndex;
        }
    }

    class MockInboundSession {
        public sessionId: string = "";
        public firstKnownIndex: number = 0;

        constructor() {
            instances += 1;
        }

        free(): void { instances -= 1; }
        pickle(key: string | Uint8Array): string { return `${this.sessionId}-pickled-session`; }
        unpickle(key: string | Uint8Array, pickle: string) {}
        create(session_key: string): string { return `${this.sessionId}-created-session`; }
        import_session(session_key: string): string { return ""; }
        decrypt(message: string): OlmDecryptionResult { return {} as OlmDecryptionResult; }
        session_id(): string { return this.sessionId; }
        first_known_index(): number { return this.firstKnownIndex; }
        export_session(message_index: number): string { return `${this.sessionId}-exported-session`; }
    }

    const PICKLE_KEY = "🥒🔑";
    const olm = {InboundGroupSession: MockInboundSession};
    const roomId = "!abc:hs.tld";
    const aliceSenderKey = "abc";
    const bobSenderKey = "def";
    const sessionId1 = "s123";
    const sessionId2 = "s456";
    const sessionId3 = "s789";
    
    return {
        "load key gives correct session": async assert => {
            const loader = new KeyLoader(olm, PICKLE_KEY, 2);
            let callback1Called = false;
            let callback2Called = false;
            const p1 = loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId1, 1), async session => {
                callback1Called = true;
                assert.equal(session.session_id(), sessionId1);
                assert.equal(session.first_known_index(), 1);
                await Promise.resolve(); // make sure they are busy in parallel
            });
            const p2 = loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId2, 2), async session => {
                callback2Called = true;
                assert.equal(session.session_id(), sessionId2);
                assert.equal(session.first_known_index(), 2);
                await Promise.resolve(); // make sure they are busy in parallel
            });
            assert.equal(loader.size, 2);
            await Promise.all([p1, p2]);
            assert(callback1Called);
            assert(callback2Called);
        },
        "keys with different first index are kept separate": async assert => {
            const loader = new KeyLoader(olm, PICKLE_KEY, 2);
            let callback1Called = false;
            let callback2Called = false;
            const p1 = loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId1, 1), async session => {
                callback1Called = true;
                assert.equal(session.session_id(), sessionId1);
                assert.equal(session.first_known_index(), 1);
                await Promise.resolve(); // make sure they are busy in parallel
            });
            const p2 = loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId1, 2), async session => {
                callback2Called = true;
                assert.equal(session.session_id(), sessionId1);
                assert.equal(session.first_known_index(), 2);
                await Promise.resolve(); // make sure they are busy in parallel
            });
            assert.equal(loader.size, 2);
            await Promise.all([p1, p2]);
            assert(callback1Called);
            assert(callback2Called);
        },
        "useKey blocks as long as no free sessions are available": async assert => {
            const loader = new KeyLoader(olm, PICKLE_KEY, 1);
            let resolve;
            let callbackCalled = false;
            loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId1, 1), async session => {
                await new Promise(r => resolve = r);
            });
            await Promise.resolve();
            assert.equal(loader.size, 1);
            const promise = loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId2, 1), session => {
                callbackCalled = true;
            });
            assert.equal(callbackCalled, false);
            resolve();
            await promise;
            assert.equal(callbackCalled, true);
        },
        "cache hit while key in use, then replace (check refCount works properly)": async assert => {
            const loader = new KeyLoader(olm, PICKLE_KEY, 1);
            let resolve1, resolve2;
            const key1 = new MockRoomKey(roomId, aliceSenderKey, sessionId1, 1);
            const p1 = loader.useKey(key1, async session => {
                await new Promise(r => resolve1 = r);
            });
            const p2 = loader.useKey(key1, async session => {
                await new Promise(r => resolve2 = r);
            });
            await Promise.resolve();
            assert.equal(loader.size, 1);
            assert.equal(loader.running, true);
            resolve1();
            await p1;
            assert.equal(loader.running, true);
            resolve2();
            await p2;
            assert.equal(loader.running, false);
            let callbackCalled = false;
            await loader.useKey(new MockRoomKey(roomId, aliceSenderKey, sessionId2, 1), async session => {
                callbackCalled = true;
                assert.equal(session.session_id(), sessionId2);
                assert.equal(session.first_known_index(), 1);
            });
            assert.equal(loader.size, 1);
            assert.equal(callbackCalled, true);
        },
        "cache hit while key not in use": async assert => {
            const loader = new KeyLoader(olm, PICKLE_KEY, 2);
            let resolve1, resolve2, invocations = 0;
            const key1 = new MockRoomKey(roomId, aliceSenderKey, sessionId1, 1);
            await loader.useKey(key1, async session => { invocations += 1; });
            assert.equal(loader.size, 1);
            const cachedKey = loader.getCachedKey(roomId, aliceSenderKey, sessionId1)!;
            assert.equal(cachedKey, key1);
            await loader.useKey(cachedKey, async session => { invocations += 1; });
            assert.equal(loader.size, 1);
            assert.equal(invocations, 2);
        }
    }
}
