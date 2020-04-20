import {Transaction} from "./transaction.js";
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

    async readTxn(storeNames) {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readonly");
            return new Transaction(txn, storeNames);
        } catch(err) {
            throw new StorageError("readTxn failed", err);
        }
    }

    async readWriteTxn(storeNames) {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readwrite");
            return new Transaction(txn, storeNames);
        } catch(err) {
            throw new StorageError("readWriteTxn failed", err);
        }
    }
}
