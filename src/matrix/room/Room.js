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

import {EventEmitter} from "../../utils/EventEmitter.js";
import {RoomSummary} from "./RoomSummary.js";
import {SyncWriter} from "./timeline/persistence/SyncWriter.js";
import {GapWriter} from "./timeline/persistence/GapWriter.js";
import {Timeline} from "./timeline/Timeline.js";
import {FragmentIdComparer} from "./timeline/FragmentIdComparer.js";
import {SendQueue} from "./sending/SendQueue.js";
import {WrappedError} from "../error.js"
import {fetchOrLoadMembers} from "./members/load.js";
import {MemberList} from "./members/MemberList.js";

export class Room extends EventEmitter {
	constructor({roomId, storage, hsApi, emitCollectionChange, sendScheduler, pendingEvents, user}) {
        super();
        this._roomId = roomId;
        this._storage = storage;
        this._hsApi = hsApi;
		this._summary = new RoomSummary(roomId, user.id);
        this._fragmentIdComparer = new FragmentIdComparer([]);
		this._syncWriter = new SyncWriter({roomId, fragmentIdComparer: this._fragmentIdComparer});
        this._emitCollectionChange = emitCollectionChange;
        this._sendQueue = new SendQueue({roomId, storage, sendScheduler, pendingEvents});
        this._timeline = null;
        this._user = user;
        this._changedMembersDuringSync = null;
	}

    /** @package */
    async writeSync(roomResponse, membership, isInitialSync, txn) {
        const isTimelineOpen = !!this._timeline;
		const summaryChanges = this._summary.writeSync(
            roomResponse,
            membership,
            isInitialSync, isTimelineOpen,
            txn);
		const {entries, newLiveKey, changedMembers} = await this._syncWriter.writeSync(roomResponse, txn);
        let removedPendingEvents;
        if (roomResponse.timeline && roomResponse.timeline.events) {
            removedPendingEvents = this._sendQueue.removeRemoteEchos(roomResponse.timeline.events, txn);
        }
        return {summaryChanges, newTimelineEntries: entries, newLiveKey, removedPendingEvents, changedMembers};
    }

    /** @package */
    afterSync({summaryChanges, newTimelineEntries, newLiveKey, removedPendingEvents, changedMembers}) {
        this._syncWriter.afterSync(newLiveKey);
        if (changedMembers.length) {
            if (this._changedMembersDuringSync) {
                for (const member of changedMembers) {
                    this._changedMembersDuringSync.set(member.userId, member);
                }
            }
            if (this._memberList) {
                this._memberList.afterSync(changedMembers);
            }
        }
        if (summaryChanges) {
            this._summary.applyChanges(summaryChanges);
            this.emit("change");
            this._emitCollectionChange(this);
        }
        if (this._timeline) {
            this._timeline.appendLiveEntries(newTimelineEntries);
        }
        if (removedPendingEvents) {
            this._sendQueue.emitRemovals(removedPendingEvents);
        }
	}

    /** @package */
    resumeSending() {
        this._sendQueue.resumeSending();
    }

    /** @package */
	load(summary, txn) {
        try {
            this._summary.load(summary);
            return this._syncWriter.load(txn);
        } catch (err) {
            throw new WrappedError(`Could not load room ${this._roomId}`, err);
        }
	}

    /** @public */
    sendEvent(eventType, content) {
        return this._sendQueue.enqueueEvent(eventType, content);
    }

    /** @public */
    async loadMemberList() {
        if (this._memberList) {
            this._memberList.retain();
            return this._memberList;
        } else {
            const members = await fetchOrLoadMembers({
                summary: this._summary,
                roomId: this._roomId,
                hsApi: this._hsApi,
                storage: this._storage,
                // to handle race between /members and /sync
                setChangedMembersMap: map => this._changedMembersDuringSync = map,
            });
            this._memberList = new MemberList({
                members,
                closeCallback: () => { this._memberList = null; }
            });
            return this._memberList;
        }
    } 

    /** @public */
    async fillGap(fragmentEntry, amount) {
        // TODO move some/all of this out of Room
        if (fragmentEntry.edgeReached) {
            return;
        }
        const response = await this._hsApi.messages(this._roomId, {
            from: fragmentEntry.token,
            dir: fragmentEntry.direction.asApiString(),
            limit: amount,
            filter: {
                lazy_load_members: true,
                include_redundant_members: true,
            }
        }).response();

        const txn = await this._storage.readWriteTxn([
            this._storage.storeNames.pendingEvents,
            this._storage.storeNames.timelineEvents,
            this._storage.storeNames.timelineFragments,
        ]);
        let removedPendingEvents;
        let gapResult;
        try {
            // detect remote echos of pending messages in the gap
            removedPendingEvents = this._sendQueue.removeRemoteEchos(response.chunk, txn);
            // write new events into gap
            const gapWriter = new GapWriter({
                roomId: this._roomId,
                storage: this._storage,
                fragmentIdComparer: this._fragmentIdComparer
            });
            gapResult = await gapWriter.writeFragmentFill(fragmentEntry, response, txn);
        } catch (err) {
            txn.abort();
            throw err;
        }
        await txn.complete();
        // once txn is committed, update in-memory state & emit events
        for (const fragment of gapResult.fragments) {
            this._fragmentIdComparer.add(fragment);
        }
        if (removedPendingEvents) {
            this._sendQueue.emitRemovals(removedPendingEvents);
        }
        if (this._timeline) {
            this._timeline.addGapEntries(gapResult.entries);
        }
    }

    /** @public */
    get name() {
        return this._summary.name;
    }

    /** @public */
    get id() {
        return this._roomId;
    }

    get avatarUrl() {
        return this._summary.avatarUrl;
    }

    get lastMessageTimestamp() {
        return this._summary.lastMessageTimestamp;
    }

    get isUnread() {
        return this._summary.isUnread;
    }

    get notificationCount() {
        return this._summary.notificationCount;
    }

    async _getLastEventId() {
        const lastKey = this._syncWriter.lastMessageKey;
        if (lastKey) {
            const txn = await this._storage.readTxn([
                this._storage.storeNames.timelineEvents,
            ]);
            const eventEntry = await txn.timelineEvents.get(this._roomId, lastKey);
            return eventEntry?.event?.event_id;
        }
    }

    async clearUnread() {
        if (this.isUnread || this.notificationCount) {
            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.roomSummary,
            ]);
            let data;
            try {
                data = this._summary.writeClearUnread(txn);
            } catch (err) {
                txn.abort();
                throw err;
            }
            await txn.complete();
            this._summary.applyChanges(data);
            this.emit("change");
            this._emitCollectionChange(this);
            
            try {
                const lastEventId = await this._getLastEventId();
                if (lastEventId) {
                    await this._hsApi.receipt(this._roomId, "m.read", lastEventId);
                }
            } catch (err) {
                // ignore ConnectionError
                if (err.name !== "ConnectionError") {
                    throw err;
                }
            }
        }
    }

    /** @public */
    async openTimeline() {
        if (this._timeline) {
            throw new Error("not dealing with load race here for now");
        }
        console.log(`opening the timeline for ${this._roomId}`);
        this._timeline = new Timeline({
            roomId: this.id,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer,
            pendingEvents: this._sendQueue.pendingEvents,
            closeCallback: () => {
                console.log(`closing the timeline for ${this._roomId}`);
                this._timeline = null;
            },
            user: this._user,
        });
        await this._timeline.load();
        return this._timeline;
    }

    get mediaRepository() {
        return this._hsApi.mediaRepository;
    }
}

