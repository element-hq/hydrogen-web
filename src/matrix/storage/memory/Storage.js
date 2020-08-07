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
