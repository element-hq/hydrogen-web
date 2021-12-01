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
