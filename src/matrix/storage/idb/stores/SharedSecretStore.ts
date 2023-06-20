/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
