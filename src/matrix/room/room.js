import RoomSummary from "./summary.js";
import RoomPersister from "./persister.js";
import EventEmitter from "../../EventEmitter.js";

export default class Room extends EventEmitter {
	constructor(roomId, storage, emitCollectionChange) {
        super();
		this._roomId = roomId;
		this._storage = storage;
		this._summary = new RoomSummary(roomId);
		this._persister = new RoomPersister(roomId);
        this._emitCollectionChange = emitCollectionChange;
	}

	async applySync(roomResponse, membership, txn) {
		const changed = this._summary.applySync(roomResponse, membership, txn);
		this._persister.persistSync(roomResponse, txn);
        if (changed) {
            this.emit("change");
            (this._emitCollectionChange)(this);
        }
	}

	load(summary, txn) {
		this._summary.load(summary);
		return this._persister.load(txn);
	}
}
