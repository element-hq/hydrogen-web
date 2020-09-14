/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {MEGOLM_ALGORITHM} from "../e2ee/common.js";


function applyTimelineEntries(data, timelineEntries, isInitialSync, isTimelineOpen, ownUserId) {
    if (timelineEntries.length) {
        data = timelineEntries.reduce((data, entry) => {
            return processTimelineEvent(data, entry,
                isInitialSync, isTimelineOpen, ownUserId);
        }, data);
    }
    return data;
}


function applySyncResponse(data, roomResponse, membership) {
    if (roomResponse.summary) {
        data = updateSummary(data, roomResponse.summary);
    }
    if (membership !== data.membership) {
        data = data.cloneIfNeeded();
        data.membership = membership;
    }
    if (roomResponse.account_data) {
        data = roomResponse.account_data.events.reduce(processRoomAccountData, data);
    }
    // state comes before timeline
    if (roomResponse.state) {
        data = roomResponse.state.events.reduce(processStateEvent, data);
    }
    const {timeline} = roomResponse;
    // process state events in timeline
    // non-state events are handled by applyTimelineEntries
    // so decryption is handled properly
    if (timeline && Array.isArray(timeline.events)) {
        data = timeline.events.reduce((data, event) => {
            if (typeof event.state_key === "string") {
                return processStateEvent(data, event);
            }
            return data;
        }, data);
    }
    const unreadNotifications = roomResponse.unread_notifications;
    if (unreadNotifications) {
        data = data.cloneIfNeeded();
        data.highlightCount = unreadNotifications.highlight_count || 0;
        data.notificationCount = unreadNotifications.notification_count;
    }

    return data;
}

function processRoomAccountData(data, event) {
    if (event?.type === "m.tag") {
        let tags = event?.content?.tags;
        if (!tags || Array.isArray(tags) || typeof tags !== "object") {
            tags = null;
        }
        data = data.cloneIfNeeded();
        data.tags = tags;
    }
    return data;
}

function processStateEvent(data, event) {
    if (event.type === "m.room.encryption") {
        const algorithm = event.content?.algorithm;
        if (!data.encryption && algorithm === MEGOLM_ALGORITHM) {
            data = data.cloneIfNeeded();
            data.encryption = event.content;
        }
    } else if (event.type === "m.room.name") {
        const newName = event.content?.name;
        if (newName !== data.name) {
            data = data.cloneIfNeeded();
            data.name = newName;
        }
    } else if (event.type === "m.room.avatar") {
        const newUrl = event.content?.url;
        if (newUrl !== data.avatarUrl) {
            data = data.cloneIfNeeded();
            data.avatarUrl = newUrl;
        }
    } else if (event.type === "m.room.canonical_alias") {
        const content = event.content;
        data = data.cloneIfNeeded();
        data.canonicalAlias = content.alias;
    }
    return data;
}

function processTimelineEvent(data, eventEntry, isInitialSync, isTimelineOpen, ownUserId) {
    if (eventEntry.eventType === "m.room.message") {
        if (!data.lastMessageTimestamp || eventEntry.timestamp > data.lastMessageTimestamp) {
            data = data.cloneIfNeeded();
            data.lastMessageTimestamp = eventEntry.timestamp;
        }
        if (!isInitialSync && eventEntry.sender !== ownUserId && !isTimelineOpen) {
            data = data.cloneIfNeeded();
            data.isUnread = true;
        }
        const {content} = eventEntry;
        const body = content?.body;
        const msgtype = content?.msgtype;
        if (msgtype === "m.text" && !eventEntry.isEncrypted) {
            data = data.cloneIfNeeded();
            data.lastMessageBody = body;
        }
    }
    return data;
}

function updateSummary(data, summary) {
    const heroes = summary["m.heroes"];
    const joinCount = summary["m.joined_member_count"];
    const inviteCount = summary["m.invited_member_count"];
    // TODO: we could easily calculate if all members are available here and set hasFetchedMembers?
    // so we can avoid calling /members...
    // we'd need to do a count query in the roomMembers store though ...
    if (heroes && Array.isArray(heroes)) {
        data = data.cloneIfNeeded();
        data.heroes = heroes;
    }
    if (Number.isInteger(inviteCount)) {
        data = data.cloneIfNeeded();
        data.inviteCount = inviteCount;
    }
    if (Number.isInteger(joinCount)) {
        data = data.cloneIfNeeded();
        data.joinCount = joinCount;
    }
    return data;
}

class SummaryData {
    constructor(copy, roomId) {
        this.roomId = copy ? copy.roomId : roomId;
        this.name = copy ? copy.name : null;
        this.lastMessageBody = copy ? copy.lastMessageBody : null;
        this.lastMessageTimestamp = copy ? copy.lastMessageTimestamp : null;
        this.isUnread = copy ? copy.isUnread : false;
        this.encryption = copy ? copy.encryption : null;
        this.isDirectMessage = copy ? copy.isDirectMessage : false;
        this.membership = copy ? copy.membership : null;
        this.inviteCount = copy ? copy.inviteCount : 0;
        this.joinCount = copy ? copy.joinCount : 0;
        this.heroes = copy ? copy.heroes : null;
        this.canonicalAlias = copy ? copy.canonicalAlias : null;
        this.hasFetchedMembers = copy ? copy.hasFetchedMembers : false;
        this.isTrackingMembers = copy ? copy.isTrackingMembers : false;
        this.avatarUrl = copy ? copy.avatarUrl : null;
        this.notificationCount = copy ? copy.notificationCount : 0;
        this.highlightCount = copy ? copy.highlightCount : 0;
        this.tags = copy ? copy.tags : null;
        this.cloned = copy ? true : false;
    }

    cloneIfNeeded() {
        if (this.cloned) {
            return this;
        } else {
            return new SummaryData(this);
        }
    }

    serialize() {
        const {cloned, ...serializedProps} = this;
        return serializedProps;
    }
}

export function needsHeroes(data) {
    return !data.name && !data.canonicalAlias && data.heroes && data.heroes.length > 0;
}

export class RoomSummary {
	constructor(roomId, ownUserId) {
        this._ownUserId = ownUserId;
        this._data = new SummaryData(null, roomId);
	}

	get name() {
		if (this._data.name) {
            return this._data.name;
        }
        if (this._data.canonicalAlias) {
            return this._data.canonicalAlias;
        }
        return null;
	}

    get heroes() {
        return this._data.heroes;
    }

    get encryption() {
        return this._data.encryption;
    }

    // whether the room name should be determined with Heroes
    get needsHeroes() {
        return needsHeroes(this._data);
    }

    get isUnread() {
        return this._data.isUnread;
    }

    get notificationCount() {
        return this._data.notificationCount;
    }

    get highlightCount() {
        return this._data.highlightCount;
    }

	get lastMessage() {
		return this._data.lastMessageBody;
	}

    get lastMessageTimestamp() {
        return this._data.lastMessageTimestamp;
    }

	get inviteCount() {
		return this._data.inviteCount;
	}

	get joinCount() {
		return this._data.joinCount;
	}

    get avatarUrl() {
        return this._data.avatarUrl;
    }

    get hasFetchedMembers() {
        return this._data.hasFetchedMembers;
    }

    get isTrackingMembers() {
        return this._data.isTrackingMembers;
    }
    
    get tags() {
        return this._data.tags;
    }

    writeClearUnread(txn) {
        const data = new SummaryData(this._data);
        data.isUnread = false;
        data.notificationCount = 0;
        data.highlightCount = 0;
        txn.roomSummary.set(data.serialize());
        return data;
    }

    writeHasFetchedMembers(value, txn) {
        const data = new SummaryData(this._data);
        data.hasFetchedMembers = value;
        txn.roomSummary.set(data.serialize());
        return data;
    }

    writeIsTrackingMembers(value, txn) {
        const data = new SummaryData(this._data);
        data.isTrackingMembers = value;
        txn.roomSummary.set(data.serialize());
        return data;
    }

    /**
     * after retrying decryption
     */
    processTimelineEntries(timelineEntries, isInitialSync, isTimelineOpen) {
        // clear cloned flag, so cloneIfNeeded makes a copy and
        // this._data is not modified if any field is changed.
        
        processTimelineEvent

        this._data.cloned = false;
        const data = applyTimelineEntries(
            this._data,
            timelineEntries,
            isInitialSync, isTimelineOpen,
            this._ownUserId);
        if (data !== this._data) {
            return data;
        }
    }

	writeSync(roomResponse, timelineEntries, membership, isInitialSync, isTimelineOpen, txn) {
        // clear cloned flag, so cloneIfNeeded makes a copy and
        // this._data is not modified if any field is changed.
        this._data.cloned = false;
        let data = applySyncResponse(this._data, roomResponse, membership);
        data = applyTimelineEntries(
            data,
            timelineEntries,
            isInitialSync, isTimelineOpen,
            this._ownUserId);
		if (data !== this._data) {
            txn.roomSummary.set(data.serialize());
            return data;
		}
	}

    /**
     * Only to be used with processTimelineEntries,
     * other methods like writeSync, writeHasFetchedMembers,
     * writeIsTrackingMembers, ... take a txn directly.
     */
    async writeAndApplyChanges(data, storage) {
        const txn = await storage.readTxn([
            storage.storeNames.roomSummary,
        ]);
        try {
            txn.roomSummary.set(data.serialize());
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        this.applyChanges(data);
    }

    applyChanges(data) {
        this._data = data;
    }

	async load(summary) {
        this._data = new SummaryData(summary);
	}
}

export function tests() {
    return {
        "membership trigger change": function(assert) {
            const summary = new RoomSummary("id");
            let written = false;
            const changes = summary.writeSync({}, "join", false, false, {roomSummary: {set: () => { written = true; }}});
            assert(changes);
            assert(written);
            assert.equal(changes.membership, "join");
        }
    }
}
