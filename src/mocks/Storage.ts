/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {StorageFactory} from "../matrix/storage/idb/StorageFactory";
import {IDOMStorage} from "../matrix/storage/idb/types";
import {Storage} from "../matrix/storage/idb/Storage";
import {Instance as nullLogger} from "../logging/NullLogger";
import {openDatabase, CreateObjectStore} from "../matrix/storage/idb/utils";

export async function createMockStorage(): Promise<Storage> {
    const idbFactory = await createMockIDBFactory();
    const FDBKeyRange = await getMockIDBKeyRange();
    return new StorageFactory(null as any, idbFactory, FDBKeyRange, new MockLocalStorage()).create("1", nullLogger.item);
}

// don't import fake-indexeddb until it's safe to assume we're actually in a unit test,
// as this is a devDependency
export async function createMockIDBFactory(): Promise<IDBFactory> {
    // @ts-ignore
    const FDBFactory = (await import("fake-indexeddb/lib/FDBFactory.js")).default;
    return new FDBFactory();
}

// don't import fake-indexeddb until it's safe to assume we're actually in a unit test,
// as this is a devDependency
export async function getMockIDBKeyRange(): Promise<typeof IDBKeyRange> {
    // @ts-ignore
    return (await import("fake-indexeddb/lib/FDBKeyRange.js")).default;
}

export function createMockDatabase(name: string, createObjectStore: CreateObjectStore, idbFactory: IDBFactory): Promise<IDBDatabase> {
    return openDatabase(name, createObjectStore, 1, idbFactory);
}

class MockLocalStorage implements IDOMStorage {
    private _map: Map<string, string>;

    constructor() {
        this._map = new Map();
    }

    getItem(key: string): string | null {
        return this._map.get(key) || null;
    }

    setItem(key: string, value: string) {
        this._map.set(key, value);
    }

    removeItem(key: string): void {
        this._map.delete(key);
    }

    get length(): number {
        return this._map.size;
    }

    key(n: number): string | null {
        const it = this._map.keys();
        let i = -1;
        let result;
        while (i < n) {
            result = it.next();
            if (result.done) {
                return null;
            }
            i += 1;
        }
        return result?.value || null;
    }
}
