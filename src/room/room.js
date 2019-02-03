class Room {

	constructor(roomId, storage, storedSummary) {
		this._roomId = roomId;
		this._storage = storage;
		this._summary = new RoomSummary(this._roomId, this._storage, storedSummary);
	}

	async applyInitialSync(roomResponse, membership) {

	}

	async applyIncrementalSync(roomResponse, membership) {

	}

	async loadFromStorage() {

	}
}