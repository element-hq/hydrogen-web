export default class SimpleTile {
    constructor({entry, emitUpdate}) {
        this._entry = entry;
        this._emitUpdate = emitUpdate;
    }
    // view model props for all subclasses
    // hmmm, could also do instanceof ... ?
    get shape() {
        // "gap" | "message" | "image" | ... ?
    }

    // don't show display name / avatar
    // probably only for MessageTiles of some sort?
    get isContinuation() {
        return false;
    }

    get hasDateSeparator() {
        return false;
    }
    // TilesCollection contract? unused atm
    get upperEntry() {
        return this._entry;
    }

    // TilesCollection contract? unused atm
    get lowerEntry() {
        return this._entry;
    }

    // TilesCollection contract
    compareEntry(entry) {
        return this._entry.compare(entry);
    }

    // update received for already included (falls within sort keys) entry
    updateEntry(entry) {
        // return names of props updated, or true for all, or null for no changes caused
        return true;
    }

    // return whether the tile should be removed
    // as SimpleTile only has one entry, the tile should be removed
    removeEntry(entry) {
        return true;
    }

    // SimpleTile can only contain 1 entry
    tryIncludeEntry() {
        return false;
    }
    // let item know it has a new sibling
    updatePreviousSibling(prev) {

    }

    // let item know it has a new sibling
    updateNextSibling(next) {
    
    }

    get internalId() {
        return this._entry.asEventKey().toString();
    }
}
