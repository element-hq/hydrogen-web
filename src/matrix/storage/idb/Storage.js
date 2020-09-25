/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {Transaction} from "./Transaction.js";
import { STORE_NAMES, StorageError } from "../common.js";

export class Storage {
    constructor(idbDatabase) {
        this._db = idbDatabase;
        const nameMap = STORE_NAMES.reduce((nameMap, name) => {
            nameMap[name] = name;
            return nameMap;
        }, {});
        this.storeNames = Object.freeze(nameMap);
    }

    _validateStoreNames(storeNames) {
        const idx = storeNames.findIndex(name => !STORE_NAMES.includes(name));
        if (idx !== -1) {
            throw new StorageError(`Tried top, a transaction unknown store ${storeNames[idx]}`);
        }
    }

    readTxn(storeNames) {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readonly");
            return new Transaction(txn, storeNames);
        } catch(err) {
            throw new StorageError("readTxn failed", err);
        }
    }

    readWriteTxn(storeNames) {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readwrite");
            return new Transaction(txn, storeNames);
        } catch(err) {
            throw new StorageError("readWriteTxn failed", err);
        }
    }

    close() {
        this._db.close();
    }
}
