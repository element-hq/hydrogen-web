/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {Store} from "../Store";
import type {UserIdentity} from "../../../e2ee/DeviceTracker";

export class UserIdentityStore {
    private _store: Store<UserIdentity>;

    constructor(store: Store<UserIdentity>) {
        this._store = store;
    }

    get(userId: string): Promise<UserIdentity | undefined> {
        return this._store.get(userId);
    }

    set(userIdentity: UserIdentity): void {
        this._store.put(userIdentity);
    }

    remove(userId: string): void {
        this._store.delete(userId);
    }
}
