import BaseEntry from "./BaseEntry.js";

export const PENDING_FRAGMENT_ID = Number.MAX_SAFE_INTEGER;

export default class PendingEventEntry extends BaseEntry {
    constructor(pendingEvent) {
        super(null);
        this._pendingEvent = pendingEvent;
    }

    get fragmentId() {
        return PENDING_FRAGMENT_ID;
    }

    get entryIndex() {
        return this._pendingEvent.queueIndex;
    }

    get content() {
        return this._pendingEvent.content;
    }

    get event() {
        return null;
    }

    get type() {
        return this._pendingEvent.eventType;
    }

    get id() {
        return this._pendingEvent.txnId;
    }
}
