// import SummaryMembers from "./members";

class ChangeSet {
    constructor(initialValues) {
        this.values = initialValues;
        this.changed = false;
        const names = Object.keys(initialValues);
        const propDefinitions = names.reduce((propDefinitions, name) => {
            propDefinitions[name] = {
                get: () => this.values[name],
                set: value => {
                    this.changed = true;
                    this.values[name] = value;
                }
            }
            return propDefinitions;
        }, {});
        Object.defineProperties(this, propDefinitions);
    }

    clone() {
        return new (this.constructor)(Object.assign({}, this.values));
    }
}

class SummaryData extends ChangeSet {

    constructor(roomId) {
        this.roomId = roomId;
        this.name = null;
        this.lastMessageBody = null;
        this.unreadCount = null;
        this.mentionCount = null;
        this.isEncrypted = null;
        this.isDirectMessage = null;
        this.membership = null;
        this.inviteCount = 0;
        this.joinCount = 0;
        this.readMarkerEventId = null;
        this.heroes = null;
        this.canonicalAlias = null;
        this.aliases = null;
    }

    clone() {
        const copy = new SummaryData(this.roomId);
        copy.name = this.name;
        copy.lastMessageBody = this.lastMessageBody;
        copy.unreadCount = this.unreadCount;
        copy.mentionCount = this.mentionCount;
        copy.isEncrypted = this.isEncrypted;
        copy.isDirectMessage = this.isDirectMessage;
        copy.membership = this.membership;
        copy.inviteCount = this.inviteCount;
        copy.joinCount = this.joinCount;
        copy.readMarkerEventId = this.readMarkerEventId;
        copy.heroes = this.heroes;
        copy.canonicalAlias = this.canonicalAlias;
        copy.aliases = this.aliases;
    }

    applySyncResponse(roomResponse, membership) {
        let changed = false;
        if (roomResponse.summary) {
            this._updateSummary(roomResponse.summary);
            changed = true;
        }
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
            if (!this.isEncrypted) {
                this.isEncrypted = true;
                return true;
            }
        }
        if (event.type === "m.room.name") {
            const newName = event.content && event.content.name;
            if (newName !== this.name) {
                this.name = newName;
                return true;
            }
        } else if (event.type === "m.room.member") {
            return this._processMembership(event);
        } else if (event.type === "m.room.message") {
            const content = event.content;
            const body = content && content.body;
            const msgtype = content && content.msgtype;
            if (msgtype === "m.text") {
                this.lastMessageBody = body;
                return true;
            }
        } else if (event.type === "m.room.canonical_alias") {
            const content = event.content;
            this.canonicalAlias = content.alias;
            return true;
        } else if (event.type === "m.room.aliases") {
            const content = event.content;
            this.aliases = content.aliases;
            return true;
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
                case "invite": this.inviteCount -= 1; break;
                case "join": this.joinCount -= 1; break;
            }
            switch (membership) {
                case "invite": this.inviteCount += 1; break;
                case "join": this.joinCount += 1; break;
            }
            changed = true;
        }
        // if (membership === "join" && content.name) {
        //  // TODO: avatar_url
        //  changed = this._members.applyMember(content.name, content.state_key) || changed;
        // }
        return changed;
    }

    _updateSummary(summary) {
        const heroes = summary["m.heroes"];
        const inviteCount = summary["m.joined_member_count"];
        const joinCount = summary["m.invited_member_count"];

        if (heroes) {
            this.heroes = heroes;
        }
        if (Number.isInteger(inviteCount)) {
            this.inviteCount = inviteCount;
        }
        if (Number.isInteger(joinCount)) {
            this.joinCount = joinCount;
        }
    }
}

export default class RoomSummary {
	constructor(roomId) {
        this._data = new SummaryData(roomId);
	}

	get name() {
		if (this._data.name) {
            return this._data.name;
        }
        if (this._data.canonicalAlias) {
            return this._data.canonicalAlias;
        }
        if (Array.isArray(this._data.aliases) && this._data.aliases.length !== 0) {
            return this._data.aliases[0];
        }
        if (Array.isArray(this._data.heroes) && this._data.heroes.length !== 0) {
            return this._data.heroes.join(", ");
        }
        return this._data.roomId;
	}

	get lastMessage() {
		return this._data.lastMessageBody;
	}

	get inviteCount() {
		return this._data.inviteCount;
	}

	get joinCount() {
		return this._data.joinCount;
	}

    // writeSync is not a good name, this isn't writing at all!
    // processSync?
	writeSync(roomResponse, membership, txn) {
        // write changes to a clone that we only 
        // reassign back once the transaction was succesfully committed
        // in afterSync
        const data = this._data.clone();
		data.applySyncResponse(roomResponse, membership, data);
		if (data.changed) {
            // need to think here how we want to persist
            // things like unread status (as read marker, or unread count)?
            // we could very well load additional things in the load method
            // ... the trade-off is between constantly writing the summary
            // on every sync, or doing a bit of extra reading on load
            // and have in-memory only variables for visualization
            txn.roomSummary.set(data.values);
            return data;
		}
	}

    afterSync(data) {
        this._data = data;
    }

	async load(summary) {
        for(const [key, value] of Object.entries(summary)) {
            this._data[key] = value;
        }
	}
}

export function tests() {
    return {
        "membership trigger change": function(assert) {
            const summary = new RoomSummary("id");
            const changes = summary.writeSync({}, "join");
            assert(changes);
            assert(changes.changed);
        }
    }
}
