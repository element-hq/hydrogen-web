export class RoomStateStore {
	constructor(idbStore) {
		this._roomStateStore = idbStore;
	}

	async getEvents(type) {

	}

	async getEventsForKey(type, stateKey) {

	}

	async setStateEvent(roomId, event) {
        const key = `${roomId}|${event.type}|${event.state_key}`;
        const entry = {roomId, event, key};
		return this._roomStateStore.put(entry);
	}
}
