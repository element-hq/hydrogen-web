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


function applyTimelineEntries(data, timelineEntries, isInitialSync, canMarkUnread, ownUserId) {
    if (timelineEntries.length) {
        data = timelineEntries.reduce((data, entry) => {
            return processTimelineEvent(data, entry,
                isInitialSync, canMarkUnread, ownUserId);
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
    const stateEvents = roomResponse?.state?.events;
    // state comes before timeline
    if (Array.isArray(stateEvents)) {
        data = stateEvents.reduce(processStateEvent, data);
    }
    const timelineEvents = roomResponse?.timeline?.events;
    // process state events in timeline
    // non-state events are handled by applyTimelineEntries
    // so decryption is handled properly
    if (Array.isArray(timelineEvents)) {
        data = timelineEvents.reduce((data, event) => {
            if (typeof event.state_key === "string") {
                return processStateEvent(data, event);
            }
            return data;
        }, data);
    }
    const unreadNotifications = roomResponse.unread_notifications;
    if (unreadNotifications) {
        const highlightCount = unreadNotifications.highlight_count || 0;
        if (highlightCount !== data.highlightCount) {
            data = data.cloneIfNeeded();
            data.highlightCount = highlightCount;
        }
        const notificationCount = unreadNotifications.notification_count;
        if (notificationCount !== data.notificationCount) {
            data = data.cloneIfNeeded();
            data.notificationCount = notificationCount;
        }
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

function processTimelineEvent(data, eventEntry, isInitialSync, canMarkUnread, ownUserId) {
    if (eventEntry.eventType === "m.room.message") {
        if (!data.lastMessageTimestamp || eventEntry.timestamp > data.lastMessageTimestamp) {
            data = data.cloneIfNeeded();
            data.lastMessageTimestamp = eventEntry.timestamp;
        }
        if (!isInitialSync && eventEntry.sender !== ownUserId && canMarkUnread) {
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
    // store the event key of the last decrypted event so when decryption does succeed,
    // we can attempt to re-decrypt from this point to update the room summary
    if (!!data.encryption && eventEntry.isEncrypted && eventEntry.isDecrypted) {
        let hasLargerEventKey = true;
        if (data.lastDecryptedEventKey) {
            try {
                hasLargerEventKey = eventEntry.compare(data.lastDecryptedEventKey) > 0;
            } catch (err) {
                // TODO: load the fragments in between here?
                // this could happen if an earlier event gets decrypted that
                // is in a fragment different from the live one and the timeline is not open.
                // In this case, we will just read too many events once per app load
                // and then keep the mapping in memory. When eventually an event is decrypted in
                // the live fragment, this should stop failing and the event key will be written.
                hasLargerEventKey = false;
            }
        }
        if (hasLargerEventKey) {
            data = data.cloneIfNeeded();
            const {fragmentId, entryIndex} = eventEntry;
            data.lastDecryptedEventKey = {fragmentId, entryIndex};
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
        this.lastDecryptedEventKey = copy ? copy.lastDecryptedEventKey : null;
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

    applyTimelineEntries(timelineEntries, isInitialSync, canMarkUnread, ownUserId) {
        return applyTimelineEntries(this, timelineEntries, isInitialSync, canMarkUnread, ownUserId);
    }

    applySyncResponse(roomResponse, membership) {
        return applySyncResponse(this, roomResponse, membership);
    }

    get needsHeroes() {
        return !this.name && !this.canonicalAlias && this.heroes && this.heroes.length > 0;
    }
}

export class RoomSummary {
	constructor(roomId) {
        this._data = null;
        this.applyChanges(new SummaryData(null, roomId));
	}

    get data() {
        return this._data;
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

	writeData(data, txn) {
		if (data !== this._data) {
            txn.roomSummary.set(data.serialize());
            return data;
		}
	}

    async writeAndApplyData(data, storage) {
        if (data === this._data) {
            return false;
        }
        const txn = storage.readWriteTxn([
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
        return true;
    }

    applyChanges(data) {
        this._data = data;
        // clear cloned flag, so cloneIfNeeded makes a copy and
        // this._data is not modified if any field is changed.
        this._data.cloned = false;
    }

	async load(summary) {
        this.applyChanges(new SummaryData(summary));
	}
}

export function tests() {
    return {
        "membership trigger change": function(assert) {
            const summary = new RoomSummary("id");
            let written = false;
            let changes = summary.data.applySyncResponse({}, "join");
            const txn = {roomSummary: {set: () => { written = true; }}};
            changes = summary.writeData(changes, txn);
            assert(changes);
            assert(written);
            assert.equal(changes.membership, "join");
        }
    }
}
