/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {Store} from "../Store";

type SharedSecret = any;

export class SharedSecretStore {
    private _store: Store<SharedSecret>;

    constructor(store: Store<SharedSecret>) {
        this._store = store;
    }

    get(name: string): Promise<SharedSecret | undefined> {
        return this._store.get(name);
    }

    set(name: string, secret: SharedSecret): void {
        secret.key = name;
        this._store.put(secret);
    }

    remove(name: string): void {
        this._store.delete(name);
    }

    deleteAllSecrets(): void {
        this._store.clear();
    }
}
