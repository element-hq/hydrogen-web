export class RoomStateStore {
	constructor(idbStore) {
		this._roomStateStore = idbStore;
	}

	async getAllForType(type) {

	}

	async get(type, stateKey) {
        
	}

	async set(roomId, event) {
        const key = `${roomId}|${event.type}|${event.state_key}`;
        const entry = {roomId, event, key};
		return this._roomStateStore.put(entry);
	}
}
