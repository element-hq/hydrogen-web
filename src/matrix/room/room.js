import RoomSummary from "./summary.js";
import RoomPersister from "./persister.js";

export default class Room {
	constructor(roomId, storage) {
		this._roomId = roomId;
		this._storage = storage;
		this._summary = new RoomSummary(roomId);
		this._persister = new RoomPersister(roomId);
	}

	async applySync(roomResponse, membership, txn) {
		this._summary.applySync(roomResponse, membership, txn);
		this._persister.persistSync(roomResponse, txn);
	}

	load(summary, txn) {
		this._summary.load(summary);
		return this._persister.load(txn);
	}
}