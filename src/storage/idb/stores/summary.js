/**
store contains:
	roomId
	name
	lastMessage
	unreadCount
	mentionCount
	isEncrypted
	isDirectMessage
	membership
*/
export default class RoomSummaryStore {
	constructor(summaryStore) {
		this._summaryStore = summaryStore;
	}

	getAll() {
		return this._summaryStore.selectAll();
	}
}
