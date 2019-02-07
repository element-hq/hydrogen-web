export default class Session {
	// loginData has device_id, user_id, home_server, access_token
	constructor(storage) {
		this._storage = storage;
		this._session = null;
		this._rooms = null;
	}
	// should be called before load
	async setLoginData(loginData) {
		const txn = this._storage.readWriteTxn([this._storage.storeNames.session]);
		const session = {loginData};
		txn.session.set(session);
		await txn.complete();
	}

	async load() {
		const txn = this._storage.readTxn([this._storage.storeNames.session]);
		this._session = await txn.session.get();
		if (!this._session) {
			throw new Error("session store is empty");
		}
		// load rooms
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
		this._session.syncToken = syncToken;
		txn.session.setSession(this._session);
	}

	get syncToken() {
		return this._session.syncToken;
	}

	get accessToken() {
		return this._session.loginData.access_token;
	}
}