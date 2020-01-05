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

    static create(roomId) {
        return new SummaryData({
            roomId: roomId,
            name: null,
            lastMessageBody: null,
            unreadCount: null,
            mentionCount: null,
            isEncrypted: null,
            isDirectMessage: null,
            membership: null,
            inviteCount: 0,
            joinCount: 0,
            readMarkerEventId: null,
            heroes: null,
            canonicalAlias: null,
            aliases: null,
        });
    }

    applySyncResponse(roomResponse, membership) {
        if (roomResponse.summary) {
            this._updateSummary(roomResponse.summary);
        }
        if (membership !== this.membership) {
            this.membership = membership;
        }
        // state comes before timeline
        if (roomResponse.state) {
            for (const e of roomResponse.state.events) {
                this._processEvent(e);
            }
        }
        if (roomResponse.timeline) {
            for(const e of roomResponse.timeline.events) {
                this._processEvent(e);
            }
        }
    }

    _processEvent(event) {
        if (event.type === "m.room.encryption") {
            if (!this.isEncrypted) {
                this.isEncrypted = true;
            }
        } else if (event.type === "m.room.name") {
            const newName = event.content && event.content.name;
            if (newName !== this.name) {
                this.name = newName;
            }
        } else if (event.type === "m.room.member") {
            this._processMembership(event);
        } else if (event.type === "m.room.message") {
            const content = event.content;
            const body = content && content.body;
            const msgtype = content && content.msgtype;
            if (msgtype === "m.text") {
                this.lastMessageBody = body;
            }
        } else if (event.type === "m.room.canonical_alias") {
            const content = event.content;
            this.canonicalAlias = content.alias;
        } else if (event.type === "m.room.aliases") {
            const content = event.content;
            this.aliases = content.aliases;
        }
    }

    _processMembership(event) {
        const prevMembership = event.prev_content && event.prev_content.membership;
        if (!event.content) {
            return;
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
        }
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
        this._data = SummaryData.create(roomId);
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
