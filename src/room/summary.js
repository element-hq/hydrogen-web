const SUMMARY_NAME_COUNT = 3;

function disambiguateMember(name, userId) {
	return `${name} (${userId})`;
}

// could even split name calculation in a separate class
// as the summary will grow more
export class RoomSummary {
	constructor(roomId) {
		this._members = new SummaryMembers();
		this._roomId = roomId;
		this._inviteCount = 0;
		this._joinCount = 0;
		this._calculatedName = null;
		this._nameFromEvent = null;
		this._lastMessageBody = null;
	}

	get name() {
		return this._nameFromEvent || this._calculatedName;
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

	async applySync(roomResponse) {
		const changed = this._processSyncResponse(roomResponse);
		if (changed) {
			await this._persist();
		}
		return changed;
	}

	async load() {
		const summary = await storage.getSummary(this._roomId);
		this._roomId = summary.roomId;
		this._inviteCount = summary.inviteCount;
		this._joinCount = summary.joinCount;
		this._calculatedName = summary.calculatedName;
		this._nameFromEvent = summary.nameFromEvent;
		this._lastMessageBody = summary.lastMessageBody;
		this._members = new SummaryMembers(summary.members);
	}

	_persist() {
		const summary = {
			roomId: this._roomId,
			heroes: this._heroes,
			inviteCount: this._inviteCount,
			joinCount: this._joinCount,
			calculatedName: this._calculatedName,
			nameFromEvent: this._nameFromEvent,
			lastMessageBody: this._lastMessageBody,
			members: this._members.asArray()
		};
		return this.storage.saveSummary(this.room_id, summary);
	}

	_processSyncResponse(roomResponse) {
		// lets not do lazy loading for now
		// if (roomResponse.summary) {
		// 	this._updateSummary(roomResponse.summary);
		// }
		let changed = false;
		if (roomResponse.limited) {
			changed = roomResponse.state_events.events.reduce((changed, e) => {
				return this._processEvent(e) || changed;
			}, changed);
		}
		changed = roomResponse.timeline.events.reduce((changed, e) => {
			return this._processEvent(e) || changed;
		}, changed);

		return changed;
	}

	_processEvent(event) {
		if (event.type === "m.room.name") {
			const newName = event.content && event.content.name;
			if (newName !== this._nameFromEvent) {
				this._nameFromEvent = newName;
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
		const membership = event.content && event.content.membership;
		// danger of a replayed event getting the count out of sync
		// but summary api will solve this.
		// otherwise we'd have to store all the member ids in here
		if (membership !== prevMembership) {
			switch (prevMembership) {
				case "invite": --this._inviteCount;
				case "join": --this._joinCount;
			}
			switch (membership) {
				case "invite": ++this._inviteCount;
				case "join": ++this._joinCount;
			}
			changed = true;
		}
		if (membership === "join" && content.name) {
			// TODO: avatar_url
			changed = this._members.applyMember(content.name, content.state_key) || changed;
		}
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

class SummaryMembers {
	constructor(initialMembers = []) {
		this._alphabeticalNames = initialMembers.map(m => m.name);
	}

	applyMember(name, userId) {
		let insertionIndex = 0;
		for (var i = this._alphabeticalNames.length - 1; i >= 0; i--) {
			const cmp = this._alphabeticalNames[i].localeCompare(name);
			// name is already in the list, disambiguate
			if (cmp === 0) {
				name = disambiguateMember(name, userId);
			}
			// name should come after already present name, stop
			if (cmp >= 0) {
				insertionIndex = i + 1;
				break;	
			}
		}
		// don't append names if list is full already
		if (insertionIndex < SUMMARY_NAME_COUNT) {
			this._alphabeticalNames.splice(insertionIndex, 0, name);
		}
		if (this._alphabeticalNames > SUMMARY_NAME_COUNT) {
			this._alphabeticalNames = this._alphabeticalNames.slice(0, SUMMARY_NAME_COUNT);
		}
	}

	get names() {
		return this._alphabeticalNames;
	}

	asArray() {
		return this._alphabeticalNames.map(n => {name: n});
	}
}
