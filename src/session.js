class Session {
	// sessionData has device_id and access_token
	constructor(sessionData) {
		this._sessionData = sessionData;
	}

	loadFromStorage() {
		// what is the PK for a session [user_id, device_id], a uuid?
	}

	start() {
		if (!this._syncToken) {
			do initial sync
		}
		do incremental sync
	}

	stop() {
		if (this._initialSync) {
			this._initialSync.abort();
		}
		if (this._incrementalSync) {
			this._incrementalSync.stop();
		}
	}

	getRoom(roomId) {
		return this._rooms[roomId];
	}

	applySync(newRooms, syncToken, accountData) {

	}
}