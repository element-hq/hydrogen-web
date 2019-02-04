class SessionStore {

	constructor(session, db) {
		this._db = new Database(db);
	}

	get session() {
		return this._session;
	}

	// or dedicated set sync_token method?
	async setAvatar(avatar) {

	}

	async setDisplayName(displayName) {

	}


	getSyncStatus() {
		return this._db.store("sync").selectFirst();
	}

	setSyncStatus(syncToken, lastSynced) {
		return this._db.store("sync").updateFirst({sync_token: syncToken, last_synced: lastSynced});
		// return updateSingletonStore(this._db, "sync", {sync_token: syncToken, last_synced: lastSynced});
	}

	setAccessToken(accessToken) {
	}

	async addRoom(room) {

	}

	async removeRoom(roomId) {

	}

	async getRoomStores() {

	}

	async getRoomStore(roomId) {

	}

	async startSyncTransaction() {
		return this._db.startSyncTxn();
	}
}
