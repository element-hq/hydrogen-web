class SyncTransaction {
	setSyncToken(syncToken, lastSynced) {

	}

	getRoomStore(roomId) {
		new RoomStore(new Database(null, this._txn), roomId)
	}

	result() {
		return txnAsPromise(this._txn);
	}
}