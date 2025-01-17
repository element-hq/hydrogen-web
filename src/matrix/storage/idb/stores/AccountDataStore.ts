/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {Store} from "../Store";
import {Content} from "../../types";

export interface AccountDataEntry {
    type: string;
    content: Content;
}

export class AccountDataStore {
    private _store: Store<AccountDataEntry>;

    constructor(store: Store<AccountDataEntry>) {
        this._store = store;
    }

    async get(type: string): Promise<AccountDataEntry | undefined> {
        return await this._store.get(type);
    }

    set(event: AccountDataEntry): void {
        this._store.put(event);
    }

    async getAll(): Promise<ReadonlyArray<AccountDataEntry>> {
        return await this._store.selectAll();
    }
}
