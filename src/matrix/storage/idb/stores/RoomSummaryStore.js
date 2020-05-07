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
	inviteCount
	joinCount
*/
export class RoomSummaryStore {
	constructor(summaryStore) {
		this._summaryStore = summaryStore;
	}

	getAll() {
		return this._summaryStore.selectAll();
	}

	set(summary) {
		return this._summaryStore.put(summary);
	}
}
