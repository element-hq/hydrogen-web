import Transaction from "./transaction.js";

export const STORE_NAMES = ["session", "roomState", "roomSummary", "roomTimeline"];

export default class Storage {
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
			throw new Error(`Tried to open a transaction for unknown store ${storeNames[idx]}`);
		}
	}

	async readTxn(storeNames) {
		this._validateStoreNames(storeNames);
		const txn = this._db.transaction(storeNames, "readonly");
		return new Transaction(txn, storeNames);
	}

	async readWriteTxn(storeNames) {
		this._validateStoreNames(storeNames);
		const txn = this._db.transaction(storeNames, "readwrite");
		return new Transaction(txn, storeNames);
	}
}