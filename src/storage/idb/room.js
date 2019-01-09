class RoomStore {

	constructor(summary, db, syncTxn) {
		this._summary = summary;
	}

	getSummary() {
		return Promise.resolve(this._summary);	
	}

	async setSummary(summary) {
		this._summary = summary;
		//...
	}

	get timelineStore() {

	}

	get memberStore() {

	}

	get stateStore() {

	}
}
