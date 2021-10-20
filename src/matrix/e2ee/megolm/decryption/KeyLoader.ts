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

import {SessionCache} from "./SessionCache";
import {IRoomKey} from "./RoomKey";

export declare class OlmInboundGroupSession {
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

/*
Because Olm only has very limited memory available when compiled to wasm,
we limit the amount of sessions held in memory.
*/
export class KeyLoader {

    public readonly cache: SessionCache;
    private pickleKey: string;
    private olm: any;
    private resolveUnusedEntry?: () => void;
    private entryBecomesUnusedPromise?: Promise<void>;

    constructor(olm: any, pickleKey: string, limit: number) {
        this.cache = new SessionCache(limit);
        this.pickleKey = pickleKey;
        this.olm = olm;
    }

    async useKey<T>(key: IRoomKey, callback: (session: OlmInboundGroupSession, pickleKey: string) => Promise<T> | T): Promise<T> {
        const cacheEntry = await this.allocateEntry(key);
        try {
            const {session} = cacheEntry;
            key.loadInto(session, this.pickleKey);
            return await callback(session, this.pickleKey);
        } finally {
            this.freeEntry(cacheEntry);
        }
    }

    get running() {
        return !!this.cache.find(entry => entry.inUse);
    }

    private async allocateEntry(key: IRoomKey): Promise<CacheEntry> {
        let entry;
        if (this.cache.size >= this.cache.limit) {
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

    private freeEntry(entry: CacheEntry) {
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
