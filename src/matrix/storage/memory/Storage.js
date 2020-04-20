import {Transaction} from "./Transaction.js";
import { STORE_MAP, STORE_NAMES } from "../common.js";

export class Storage {
	constructor(initialStoreValues = {}) {
        this._validateStoreNames(Object.keys(initialStoreValues));
		this.storeNames = STORE_MAP;
        this._storeValues = STORE_NAMES.reduce((values, name) => {
            values[name] = initialStoreValues[name] || null;
        }, {});
	}

	_validateStoreNames(storeNames) {
		const idx = storeNames.findIndex(name => !STORE_MAP.hasOwnProperty(name));
		if (idx !== -1) {
			throw new Error(`Invalid store name ${storeNames[idx]}`);
		}
	}

    _createTxn(storeNames, writable) {
        this._validateStoreNames(storeNames);
        const storeValues = storeNames.reduce((values, name) => {
            return values[name] = this._storeValues[name];
        }, {});
        return Promise.resolve(new Transaction(storeValues, writable));
    }

	readTxn(storeNames) {
        // TODO: avoid concurrency
        return this._createTxn(storeNames, false);
	}

	readWriteTxn(storeNames) {
        // TODO: avoid concurrency
		return this._createTxn(storeNames, true);
	}
}
