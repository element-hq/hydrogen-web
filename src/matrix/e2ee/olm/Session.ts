/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {OlmSessionEntry} from "../../storage/idb/stores/OlmSessionStore";
import type * as OlmNamespace from "@matrix-org/olm";
type Olm = typeof OlmNamespace;

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
