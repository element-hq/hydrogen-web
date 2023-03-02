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

import {MEGOLM_ALGORITHM} from "../e2ee/common";
import {iterateResponseStateEvents} from "./common";

function applyTimelineEntries(data, timelineEntries, isInitialSync, canMarkUnread, ownUserId) {
    if (timelineEntries.length) {
        data = timelineEntries.reduce((data, entry) => {
            return processTimelineEvent(data, entry,
                isInitialSync, canMarkUnread, ownUserId);
        }, data);
    }
    return data;
}

function applySyncResponse(data, roomResponse, membership, ownUserId) {
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
    // process state events in state and in timeline.
    // non-state events are handled by applyTimelineEntries
    // so decryption is handled properly
    iterateResponseStateEvents(roomResponse, event => {
        data = processStateEvent(data, event, ownUserId);
    });
    const unreadNotifications = roomResponse.unread_notifications;
    if (unreadNotifications) {
        data = processNotificationCounts(data, unreadNotifications);
    }

    return data;
}

function processNotificationCounts(data, unreadNotifications) {
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

export function processStateEvent(data, event, ownUserId) {
    if (event.type === "m.room.create") {
        data = data.cloneIfNeeded();
        data.lastMessageTimestamp = event.origin_server_ts;
    } else if (event.type === "m.room.encryption") {
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
    } else if (event.type === "m.room.member") {
        const content = event.content;
        if (content.is_direct === true && content.membership === "invite" && !data.isDirectMessage) {
            let other;
            if (event.sender === ownUserId) {
                other = event.state_key;
            } else if (event.state_key === ownUserId) {
                other = event.sender;
            }
            if (other) {
                data = data.cloneIfNeeded();
                data.isDirectMessage = true;
                data.dmUserId = other;
            }
        } else if (content.membership === "leave" && data.isDirectMessage && data.dmUserId === event.state_key) {
            data = data.cloneIfNeeded();
            data.isDirectMessage = false;
            data.dmUserId = null;
        }
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

export class SummaryData {
    constructor(copy, roomId) {
        this.roomId = copy ? copy.roomId : roomId;
        this.name = copy ? copy.name : null;
        this.lastMessageTimestamp = copy ? copy.lastMessageTimestamp : null;
        this.isUnread = copy ? copy.isUnread : false;
        this.encryption = copy ? copy.encryption : null;
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
        this.isDirectMessage = copy ? copy.isDirectMessage : false;
        this.dmUserId = copy ? copy.dmUserId : null;
        this.cloned = copy ? true : false;
    }

    changedKeys(other) {
        const props = Object.getOwnPropertyNames(this);
        return props.filter(prop => {
            return prop !== "cloned" && this[prop] !== other[prop]
        });
    }

    cloneIfNeeded() {
        if (this.cloned) {
            return this;
        } else {
            return new SummaryData(this);
        }
    }

    serialize() {
        return Object.entries(this).reduce((obj, [key, value]) => {
            if (key !== "cloned" && value !== null) {
                obj[key] = value;
            }
            return obj;
        }, {});
    }

    applyTimelineEntries(timelineEntries, isInitialSync, canMarkUnread, ownUserId) {
        return applyTimelineEntries(this, timelineEntries, isInitialSync, canMarkUnread, ownUserId);
    }

    applySyncResponse(roomResponse, membership, ownUserId) {
        return applySyncResponse(this, roomResponse, membership, ownUserId);
    }

    get needsHeroes() {
        return !this.name && !this.canonicalAlias && this.heroes && this.heroes.length > 0;
    }

    isNewJoin(oldData) {
        return this.membership === "join" && oldData.membership !== "join";
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

    /** move summary to archived store when leaving the room */
    writeArchivedData(data, txn) {
        if (data !== this._data) {
            txn.archivedRoomSummary.set(data.serialize());
            return data;
        }
    }

    async writeAndApplyData(data, storage) {
        if (data === this._data) {
            return false;
        }
        const txn = await storage.readWriteTxn([
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
        "serialize doesn't include null fields or cloned": assert => {
            const roomId = "!123:hs.tld";
            const data = new SummaryData(null, roomId);
            const clone = data.cloneIfNeeded();
            const serialized = clone.serialize();
            assert.strictEqual(serialized.cloned, undefined);
            assert.equal(serialized.roomId, roomId);
            const nullCount = Object.values(serialized).reduce((count, value) => count + value === null ? 1 : 0, 0);
            assert.strictEqual(nullCount, 0);
        }
    }
}
