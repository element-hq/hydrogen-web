export default class RoomStateStore {
	constructor(idbStore) {
		this._roomStateStore = idbStore;
	}

	async getEvents(type) {

	}

	async getEventsForKey(type, stateKey) {

	}

	async setStateEvent(roomId, event) {
		return this._roomStateStore.put({roomId, event});
	}
}