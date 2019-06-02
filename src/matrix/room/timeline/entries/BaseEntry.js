//entries can be sorted, first by fragment, then by entry index.
import EventKey from "../EventKey.js";

export default class BaseEntry {
    constructor(fragmentIdComparer) {
        this._fragmentIdComparer = fragmentIdComparer;
    }

    get fragmentId() {
        throw new Error("unimplemented");
    }

    get entryIndex() {
        throw new Error("unimplemented");
    }

    compare(otherEntry) {
        if (this.fragmentId === otherEntry.fragmentId) {
            return this.entryIndex - otherEntry.entryIndex;
        } else {
            // This might throw if the relation of two fragments is unknown.
            return this._fragmentIdComparer.compare(this.fragmentId, otherEntry.fragmentId);
        }
    }

    asEventKey() {
        return new EventKey(this.fragmentId, this.entryIndex);
    }
}
