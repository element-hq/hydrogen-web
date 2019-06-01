import BaseEntry from "./BaseEntry.js";

export default class EventEntry extends BaseEntry {
    constructor(eventEntry, fragmentIdComparator) {
        super(fragmentIdComparator);
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

    get event() {
        return this._eventEntry.event;
    }

    get type() {
        return this._eventEntry.event.type;
    }

    get id() {
        return this._eventEntry.event.event_id;
    }
}
