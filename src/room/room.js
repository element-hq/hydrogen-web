class Room {

	constructor(roomId, storage) {
		this._roomId = roomId;
		this._storage = storage;
		this._summary = new RoomSummary(this._roomId, this._storage);
	}

	async applyInitialSync(roomResponse, membership) {

	}

	async applyIncrementalSync(roomResponse, membership) {

	}

	async load() {

	}
}