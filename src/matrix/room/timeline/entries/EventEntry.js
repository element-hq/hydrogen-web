import BaseEntry from "./BaseEntry.js";

export default class EventEntry extends BaseEntry {
    constructor(eventEntry, fragmentIdComparer) {
        super(fragmentIdComparer);
        this._eventEntry = eventEntry;
    }

    get fragmentId() {
        return this._eventEntry.fragmentId;
    }

    get entryIndex() {
        return this._eventEntry.eventIndex;
    }

    get content() {
        return this._eventEntry.event.content;
    }

    get prevContent() {
        const unsigned = this._eventEntry.event.unsigned;
        return unsigned && unsigned.prev_content;
    }

    get eventType() {
        return this._eventEntry.event.type;
    }

    get stateKey() {
        return this._eventEntry.event.state_key;
    }

    get sender() {
        return this._eventEntry.event.sender;
    }

    get timestamp() {
        return this._eventEntry.event.origin_server_ts;
    }

    get id() {
        return this._eventEntry.event.event_id;
    }
}
