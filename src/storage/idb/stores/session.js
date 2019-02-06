/**
store contains:
	loginData {
		device_id
		home_server
		access_token
		user_id
	}
	// flags {
	// 	lazyLoading?
	// }
	syncToken
	displayName
	avatarUrl
	lastSynced
*/
class SessionStore {

	constructor(sessionStore) {
		this._sessionStore = sessionStore;
	}

	readSession() {
		return this._session;
	}

	writeSession(session) {

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
