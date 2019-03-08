import { ObservableArray } from "../../observable/index.js";
import sortedIndex from "../../utils/sortedIndex.js";

export default class Timeline {
    constructor({roomId, storage, closeCallback}) {
        this._roomId = roomId;
        this._storage = storage;
        this._closeCallback = closeCallback;
        this._entriesList = new ObservableArray();
    }

    /** @package */
    async load() {
        const txn = await this._storage.readTxn([this._storage.storeNames.roomTimeline]);
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
    async fillGap(gapEntry, amount) {
        const gap = gapEntry.gap;
        let direction;
        if (gap.prev_batch) {
            direction = "b";
        } else if (gap.next_batch) {
            direction = "f";
        } else {
            throw new Error("Invalid gap, no prev_batch or next_batch field: " + JSON.stringify(gapEntry.gap));
        }
        const token = gap.prev_batch || gap.next_batch;

        const response = await this._hsApi.messages(this._roomId, {
            from: token,
            dir: direction,
            limit: amount
        });

        const newEntries = await this._persister.persistGapFill(gapEntry, response);
        // find where to replace existing gap with newEntries by doing binary search
        const gapIdx = sortedIndex(this._entriesList.array, gapEntry.sortKey, (key, entry) => {
            return key.compare(entry.sortKey);
        });
        // only replace the gap if it's currently in the timeline
        if (this._entriesList.at(gapIdx) === gapEntry) {
            this._entriesList.removeAt(gapIdx);
            this._entriesList.insertMany(gapIdx, newEntries);
        }
    }

    async loadAtTop(amount) {
        const firstEntry = this._entriesList.at(0);
        if (firstEntry) {
            const txn = await this._storage.readTxn([this._storage.storeNames.roomTimeline]);
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
