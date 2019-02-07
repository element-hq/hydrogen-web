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
export default class SessionStore {
	constructor(sessionStore) {
		this._sessionStore = sessionStore;
	}

	async get() {
		const session = await this._sessionStore.selectFirst(IDBKeyRange.only(1));
		if (session) {
			return session.value;
		}
	}

	set(session) {
		return this._sessionStore.put({key: 1, value: session});
	}
}
