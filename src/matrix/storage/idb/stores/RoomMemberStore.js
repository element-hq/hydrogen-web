// no historical members for now
export class RoomMemberStore {
    constructor(roomMembersStore) {
        this._roomMembersStore = roomMembersStore;
    }

	get(roomId, userId) {
        return this._roomMembersStore.get([roomId, userId]);
	}

	async set(member) {
        return this._roomMembersStore.put(member);
	}

	/*
    async getMemberAtSortKey(roomId, userId, sortKey) {

	}

	async getSortedMembers(roomId, offset, amount) {

	}
    */
}
