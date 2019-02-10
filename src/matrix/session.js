import Room from "./room/room.js";

export default class Session {
	constructor(storage) {
		this._storage = storage;
		this._session = null;
		// use Map here?
		this._rooms = {};
	}
	// should be called before load
	// loginData has device_id, user_id, home_server, access_token
	async setLoginData(loginData) {
		console.log("session.setLoginData");
		const txn = this._storage.readWriteTxn([this._storage.storeNames.session]);
		const session = {loginData};
		txn.session.set(session);
		await txn.complete();
	}

	async load() {
		const txn = this._storage.readTxn([
			this._storage.storeNames.session,
			this._storage.storeNames.roomSummary,
			this._storage.storeNames.roomState,
			this._storage.storeNames.roomTimeline,
		]);
		// restore session object
		this._session = await txn.session.get();
		if (!this._session) {
			throw new Error("session store is empty");
		}
		// load rooms
		const rooms = await txn.roomSummary.getAll();
		await Promise.all(rooms.map(summary => {
			const room = this.createRoom(summary.roomId);
			return room.load(summary, txn);
		}));
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
		txn.session.set(this._session);
	}

	get syncToken() {
		return this._session.syncToken;
	}

	get accessToken() {
		return this._session.loginData.access_token;
	}
}