/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {Store} from "../Store";

interface OutboundSession {
    roomId: string;
    session: string;
    createdAt: number;
}

export class OutboundGroupSessionStore {
    private _store: Store<OutboundSession>;

    constructor(store: Store<OutboundSession>) {
        this._store = store;
    }

    remove(roomId: string): void {
        this._store.delete(roomId);
    }

    get(roomId: string): Promise<OutboundSession | undefined> {
        return this._store.get(roomId);
    }

    set(session: OutboundSession): void {
        this._store.put(session);
    }
}
