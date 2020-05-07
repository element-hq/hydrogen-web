import {RoomTimelineStore} from "./stores/RoomTimelineStore.js";

export class Transaction {
    constructor(storeValues, writable) {
        this._storeValues = storeValues;
        this._txnStoreValues = {};
        this._writable = writable;
    }

    _store(name, mapper) {
        if (!this._txnStoreValues.hasOwnProperty(name)) {
            if (!this._storeValues.hasOwnProperty(name)) {
                throw new Error(`Transaction wasn't opened for store ${name}`);
            }
            const store = mapper(this._storeValues[name]);
            const clone = store.cloneStoreValue();
            // extra prevention for writing
            if (!this._writable) {
                Object.freeze(clone);
            }
            this._txnStoreValues[name] = clone;
        }
        return mapper(this._txnStoreValues[name]);
    }

    get session() {
        throw new Error("not yet implemented");
        // return this._store("session", storeValue => new SessionStore(storeValue));
    }

    get roomSummary() {
        throw new Error("not yet implemented");
        // return this._store("roomSummary", storeValue => new RoomSummaryStore(storeValue));
    }

    get roomTimeline() {
        return this._store("roomTimeline", storeValue => new RoomTimelineStore(storeValue));
    }

    get roomState() {
        throw new Error("not yet implemented");
        // return this._store("roomState", storeValue => new RoomStateStore(storeValue));
    }

    complete() {
        for(let name of Object.keys(this._txnStoreValues)) {
            this._storeValues[name] = this._txnStoreValues[name];
        }
        this._txnStoreValues = null;
        return Promise.resolve();
    }

    abort() {
        this._txnStoreValues = null;
        return Promise.resolve();
    }
}
