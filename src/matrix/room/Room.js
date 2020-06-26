import {EventEmitter} from "../../utils/EventEmitter.js";
import {RoomSummary} from "./RoomSummary.js";
import {SyncWriter} from "./timeline/persistence/SyncWriter.js";
import {GapWriter} from "./timeline/persistence/GapWriter.js";
import {Timeline} from "./timeline/Timeline.js";
import {FragmentIdComparer} from "./timeline/FragmentIdComparer.js";
import {SendQueue} from "./sending/SendQueue.js";

export class Room extends EventEmitter {
	constructor({roomId, storage, hsApi, emitCollectionChange, sendScheduler, pendingEvents, user}) {
        super();
        this._roomId = roomId;
        this._storage = storage;
        this._hsApi = hsApi;
		this._summary = new RoomSummary(roomId);
        this._fragmentIdComparer = new FragmentIdComparer([]);
		this._syncWriter = new SyncWriter({roomId, fragmentIdComparer: this._fragmentIdComparer});
        this._emitCollectionChange = emitCollectionChange;
        this._sendQueue = new SendQueue({roomId, storage, sendScheduler, pendingEvents});
        this._timeline = null;
        this._user = user;
	}

    async writeSync(roomResponse, membership, txn) {
		const summaryChanges = this._summary.writeSync(roomResponse, membership, txn);
		const {entries, newLiveKey} = await this._syncWriter.writeSync(roomResponse, txn);
        let removedPendingEvents;
        if (roomResponse.timeline && roomResponse.timeline.events) {
            removedPendingEvents = this._sendQueue.removeRemoteEchos(roomResponse.timeline.events, txn);
        }
        return {summaryChanges, newTimelineEntries: entries, newLiveKey, removedPendingEvents};
    }

    afterSync({summaryChanges, newTimelineEntries, newLiveKey, removedPendingEvents}) {
        this._syncWriter.afterSync(newLiveKey);
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

    resumeSending() {
        this._sendQueue.resumeSending();
    }

	load(summary, txn) {
		this._summary.load(summary);
		return this._syncWriter.load(txn);
	}

    sendEvent(eventType, content) {
        return this._sendQueue.enqueueEvent(eventType, content);
    }

    async loadMemberList() {
        let members;
        if (!this._summary.hasFetchedMembers) {
            // we need to get the syncToken here!
            const memberResponse = await this._hsApi.members(this._roomId, syncToken).response;

            const txn = await this._storage.readWriteTxn([
                this._storage.storeNames.roomSummary,
                this._storage.storeNames.roomMembers,
            ]);
            const summaryChanges = this._summary.writeHasFetchedMembers(true, txn);
            const {roomMembers} = txn;
            const memberEvents = memberResponse.chunk;
            if (!Array.isArray(memberEvents)) {
                throw new Error("malformed");
            }
            members = await Promise.all(memberEvents.map(async memberEvent => {
                const userId = memberEvent && memberEvent.state_key;
                if (!userId) {
                    throw new Error("malformed");
                }
                const memberData = await roomMembers.get(this._roomId, userId);
                const member = updateOrCreateMember(this._roomId, memberData, event);
                if (member) {
                    roomMembers.set(member.serialize());
                }
                return member;
            }));
            await txn.complete();
            this._summary.applyChanges(summaryChanges);
        }
        return new MemberList(this._roomId, members, this._storage);
    } 


    /** @public */
    async fillGap(fragmentEntry, amount) {
        const response = await this._hsApi.messages(this._roomId, {
            from: fragmentEntry.token,
            dir: fragmentEntry.direction.asApiString(),
            limit: amount,
            filter: {lazy_load_members: true}
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

    get name() {
        return this._summary.name;
    }

    get id() {
        return this._roomId;
    }

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

    mxcUrlThumbnail(url, width, height, method) {
        return this._hsApi.mxcUrlThumbnail(url, width, height, method);
    }

    mxcUrl(url) {
        return this._hsApi.mxcUrl(url);
    }
}

