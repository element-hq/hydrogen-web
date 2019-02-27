import { ObservableArray } from "../../observable/index.js";

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
    get entries() {
        return this._entriesList;
    }

    /** @public */
    close() {
        this._closeCallback();
    }
}
