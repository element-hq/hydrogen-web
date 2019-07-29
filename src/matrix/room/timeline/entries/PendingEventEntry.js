import BaseEntry, {PENDING_FRAGMENT_ID} from "./BaseEntry.js";

export default class PendingEventEntry extends BaseEntry {
    constructor({pendingEvent, user}) {
        super(null);
        this._pendingEvent = pendingEvent;
        this._user = user;
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

    get eventType() {
        return this._pendingEvent.eventType;
    }

    get stateKey() {
        return null;
    }

    get sender() {
        return this._user.id;
    }

    get timestamp() {
        return null;
    }

    get id() {
        return this._pendingEvent.txnId;
    }
}
