// import SummaryMembers from "./members";

export default class RoomSummary {
	constructor(roomId) {
		// this._members = new SummaryMembers();
		this._roomId = roomId;
		this._name = null;
		this._lastMessageBody = null;
		this._unreadCount = null;
		this._mentionCount = null;
		this._isEncrypted = null;
		this._isDirectMessage = null;
		this._membership = null;
		this._inviteCount = 0;
		this._joinCount = 0;
		this._readMarkerEventId = null;
	}

	get name() {
		return this._name || this._roomId;
	}

	get lastMessage() {
		return this._lastMessageBody;
	}

	get inviteCount() {
		return this._inviteCount;
	}

	get joinCount() {
		return this._joinCount;
	}

	async applySync(roomResponse, membership, txn) {
		const changed = this._processSyncResponse(roomResponse, membership);
		if (changed) {
			await this._persist(txn);
		}
		return changed;
	}

	async load(summary) {
		this._roomId = summary.roomId;
		this._name = summary.name;
		this._lastMessageBody = summary.lastMessageBody;
		this._unreadCount = summary.unreadCount;
		this._mentionCount = summary.mentionCount;
		this._isEncrypted = summary.isEncrypted;
		this._isDirectMessage = summary.isDirectMessage;
		this._membership = summary.membership;
		this._inviteCount = summary.inviteCount;
		this._joinCount = summary.joinCount;
		this._readMarkerEventId = summary.readMarkerEventId;
	}

	_persist(txn) {
		// need to think here how we want to persist
		// things like unread status (as read marker, or unread count)?
		// we could very well load additional things in the load method
		// ... the trade-off is between constantly writing the summary
		// on every sync, or doing a bit of extra reading on load
		// and have in-memory only variables for visualization
		const summary = {
			roomId: this._roomId,
			name: this._name,
			lastMessageBody: this._lastMessageBody,
			unreadCount: this._unreadCount,
			mentionCount: this._mentionCount,
			isEncrypted: this._isEncrypted,
			isDirectMessage: this._isDirectMessage,
			membership: this._membership,
			inviteCount: this._inviteCount,
			joinCount: this._joinCount,
			readMarkerEventId: this._readMarkerEventId,
		};
		return txn.roomSummary.set(summary);
	}

	_processSyncResponse(roomResponse, membership) {
		// lets not do lazy loading for now
		// if (roomResponse.summary) {
		// 	this._updateSummary(roomResponse.summary);
		// }
		let changed = false;
		if (membership !== this._membership) {
			this._membership = membership;
			changed = true;
		}
        // state comes before timeline
		if (roomResponse.state) {
			changed = roomResponse.state.events.reduce((changed, e) => {
				return this._processEvent(e) || changed;
			}, changed);
		}
		if (roomResponse.timeline) {
			changed = roomResponse.timeline.events.reduce((changed, e) => {
				return this._processEvent(e) || changed;
			}, changed);
		}

		return changed;
	}

	_processEvent(event) {
		if (event.type === "m.room.encryption") {
			if (!this._isEncrypted) {
				this._isEncrypted = true;
				return true;
			}
		}
		if (event.type === "m.room.name") {
			const newName = event.content && event.content.name;
			if (newName !== this._name) {
				this._name = newName;
				return true;
			}
		} else if (event.type === "m.room.member") {
			return this._processMembership(event);
		} else if (event.type === "m.room.message") {
			const content = event.content;
			const body = content && content.body;
			const msgtype = content && content.msgtype;
			if (msgtype === "m.text") {
				this._lastMessageBody = body;
				return true;
			}
		}
		return false;
	}

	_processMembership(event) {
		let changed = false;
		const prevMembership = event.prev_content && event.prev_content.membership;
		if (!event.content) {
			return changed;
		}
		const content = event.content;
		const membership = content.membership;
		// danger of a replayed event getting the count out of sync
		// but summary api will solve this.
		// otherwise we'd have to store all the member ids in here
		if (membership !== prevMembership) {
			switch (prevMembership) {
				case "invite": --this._inviteCount; break;
				case "join": --this._joinCount; break;
			}
			switch (membership) {
				case "invite": ++this._inviteCount; break;
				case "join": ++this._joinCount; break;
			}
			changed = true;
		}
		// if (membership === "join" && content.name) {
		// 	// TODO: avatar_url
		// 	changed = this._members.applyMember(content.name, content.state_key) || changed;
		// }
		return changed;
	}

	_updateSummary(summary) {
		const heroes = summary["m.heroes"];
		const inviteCount = summary["m.joined_member_count"];
		const joinCount = summary["m.invited_member_count"];

		if (heroes) {
			this._heroes = heroes;
		}
		if (Number.isInteger(inviteCount)) {
			this._inviteCount = inviteCount;
		}
		if (Number.isInteger(joinCount)) {
			this._joinCount = joinCount;
		}
		// this._recaculateNameIfNoneSet();
	}
}
