import EventEmitter from "../../EventEmitter.js";
import RoomSummary from "./summary.js";
import SyncWriter from "./timeline/persistence/SyncWriter.js";
import Timeline from "./timeline/Timeline.js";
import FragmentIdComparer from "./timeline/FragmentIdComparer.js";
import SendQueue from "./sending/SendQueue.js";

export default class Room extends EventEmitter {
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
        if (summaryChanges) {
            this._summary.afterSync(summaryChanges);
            this.emit("change");
            this._emitCollectionChange(this);
        }
        this._syncWriter.setKeyOnCompleted(newLiveKey);
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
        this._sendQueue.enqueueEvent(eventType, content);
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
        this._timeline = new Timeline({
            roomId: this.id,
            storage: this._storage,
            hsApi: this._hsApi,
            fragmentIdComparer: this._fragmentIdComparer,
            pendingEvents: this._sendQueue.pendingEvents,
            closeCallback: () => this._timeline = null,
            user: this._user,
        });
        await this._timeline.load();
        return this._timeline;
    }
}

