export default class Session {
	// sessionData has device_id, user_id, home_server (not access_token, that is for network)
	constructor(sessionData, storage) {
		this._sessionData = sessionData;
		this._storage = storage;
		this._rooms = {};
		this._syncToken = null;
	}

	load() {
		// what is the PK for a session [user_id, device_id], a uuid?
	}

	getRoom(roomId) {
		return this._rooms[roomId];
	}

	createRoom(roomId) {
		const room = new Room(roomId, this._storage);
		this._rooms[roomId] = room;
		return room;
	}

	applySync(syncToken, accountData, txn) {
		this._syncToken = syncToken;
		txn.session.setSyncToken(syncToken);
	}
}