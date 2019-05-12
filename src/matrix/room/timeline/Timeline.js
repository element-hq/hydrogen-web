import { ObservableArray } from "../../../observable/index.js";
import sortedIndex from "../../../utils/sortedIndex.js";
import GapPersister from "./persistence/GapPersister.js";

export default class Timeline {
    constructor({roomId, storage, closeCallback, fragmentIdComparer}) {
        this._roomId = roomId;
        this._storage = storage;
        this._closeCallback = closeCallback;
        this._entriesList = new ObservableArray();
        this._fragmentIdComparer = fragmentIdComparer;
    }

    /** @package */
    async load() {
        const txn = await this._storage.readTxn([this._storage.storeNames.timelineEvents]);
        const entries = await txn.roomTimeline.lastEvents(this._roomId, 100);
        for (const entry of entries) {
            this._entriesList.append(entry);
        }
    }

    /** @package */
    appendLiveEntries(newEntries) {
        for (const entry of newEntries) {
            this._entriesList.append(entry);
        }
    }

    /** @public */
    async fillGap(fragmentEntry, amount) {
        const response = await this._hsApi.messages(this._roomId, {
            from: fragmentEntry.token,
            dir: fragmentEntry.direction.asApiString(),
            limit: amount
        });

        const gapPersister = new GapPersister({
            roomId: this._roomId,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer
        });
        const newEntries = await gapPersister.persistFragmentFill(fragmentEntry, response);
        // find where to replace existing gap with newEntries by doing binary search
        const gapIdx = sortedIndex(this._entriesList.array, fragmentEntry, (fragmentEntry, entry) => {
            return fragmentEntry.compare(entry);
        });
        // only replace the gap if it's currently in the timeline
        if (this._entriesList.at(gapIdx) === fragmentEntry) {
            this._entriesList.removeAt(gapIdx);
            this._entriesList.insertMany(gapIdx, newEntries);
        }
    }

    async loadAtTop(amount) {
        const firstEntry = this._entriesList.at(0);
        if (firstEntry) {
            const txn = await this._storage.readTxn([this._storage.storeNames.timelineEvents]);
            const topEntries = await txn.roomTimeline.eventsBefore(this._roomId, firstEntry.sortKey, amount);
            this._entriesList.insertMany(0, topEntries);
            return topEntries.length;
        }
    }

    /** @public */
    get entries() {
        return this._entriesList;
    }

    /** @public */
    close() {
        this._closeCallback();
    }
}
