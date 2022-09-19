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

import type {OlmSessionEntry} from "../../storage/idb/stores/OlmSessionStore";
import type * as OlmNamespace from "@matrix-org/olm";
export type Olm = typeof OlmNamespace;

export function createSessionEntry(olmSession: Olm.Session, senderKey: string, timestamp: number, pickleKey: string): OlmSessionEntry {
    return {
        session: olmSession.pickle(pickleKey),
        sessionId: olmSession.session_id(),
        senderKey,
        lastUsed: timestamp,
    };
}

export class Session {
    public isModified: boolean;

    constructor(
        public readonly data: OlmSessionEntry,
        private readonly pickleKey: string,
        private readonly olm: Olm,
        public isNew: boolean = false
    ) {
        this.isModified = isNew;
    }

    static create(senderKey: string, olmSession: Olm.Session, olm: Olm, pickleKey: string, timestamp: number): Session {
        const data = createSessionEntry(olmSession, senderKey, timestamp, pickleKey);
        return new Session(data, pickleKey, olm, true);
    }

    get id(): string {
        return this.data.sessionId;
    }

    load(): Olm.Session {
        const session = new this.olm.Session();
        session.unpickle(this.pickleKey, this.data.session);
        return session;
    }

    unload(olmSession: Olm.Session): void {
        olmSession.free();
    }

    save(olmSession: Olm.Session): void {
        this.data.session = olmSession.pickle(this.pickleKey);
        this.isModified = true;
    }
}
