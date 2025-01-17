/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {MIN_UNICODE, MAX_UNICODE} from "./common";
import {Store} from "../Store";

export function encodeScopeTypeKey(scope: string, type: string): string {
    return `${scope}|${type}`;
}

interface BaseOperation {
    id: string;
    scope: string;
    userIds: string[];
}

type OperationType = { type: "share_room_key"; roomKeyMessage: RoomKeyMessage; }

type Operation = BaseOperation & OperationType

type OperationEntry = Operation & { scopeTypeKey: string; }

interface RoomKeyMessage {
    room_id: string;
    session_id: string;
    session_key: string;
    algorithm: string;
    chain_index: number;
}

export class OperationStore {
    private _store: Store<OperationEntry>;

    constructor(store: Store<OperationEntry>) {
        this._store = store;
    }

    getAll(): Promise<Operation[]> {
        return this._store.selectAll();
    }

    async getAllByTypeAndScope(type: string, scope: string): Promise<Operation[]> {
        const key = encodeScopeTypeKey(scope, type);
        const results: Operation[] = [];
        await this._store.index("byScopeAndType").iterateWhile(key, value => {
            if (value.scopeTypeKey !== key) {
                return false;
            }
            results.push(value);
            return true;
        });
        return results;
    }

    add(operation: Operation): void {
        (operation as OperationEntry).scopeTypeKey = encodeScopeTypeKey(operation.scope, operation.type);
        this._store.add(operation as OperationEntry);
    }

    update(operation: Operation): void {
        this._store.put(operation as OperationEntry);
    }

    remove(id: string): void {
        this._store.delete(id);
    }

    async removeAllForScope(scope: string): Promise<undefined> {
        const range = this._store.IDBKeyRange.bound(
            encodeScopeTypeKey(scope, MIN_UNICODE),
            encodeScopeTypeKey(scope, MAX_UNICODE)
        );
        const index = this._store.index("byScopeAndType");
        await index.iterateValues(range, (_, __, cur) => {
            cur.delete();
            return true;
        });
        return;
    }
}
