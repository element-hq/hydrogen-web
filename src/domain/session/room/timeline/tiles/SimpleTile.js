import {UpdateAction} from "../UpdateAction.js";

export class SimpleTile {
    constructor({entry}) {
        this._entry = entry;
        this._emitUpdate = null;
    }
    // view model props for all subclasses
    // hmmm, could also do instanceof ... ?
    get shape() {
        return null;
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

    emitUpdate(paramName) {
        if (this._emitUpdate) {
            this._emitUpdate(this, paramName);
        }
    }

    get internalId() {
        return this._entry.asEventKey().toString();
    }

    get isPending() {
        return this._entry.isPending;
    }
    // TilesCollection contract below
    setUpdateEmit(emitUpdate) {
        this._emitUpdate = emitUpdate;
    }

    get upperEntry() {
        return this._entry;
    }

    get lowerEntry() {
        return this._entry;
    }

    compareEntry(entry) {
        return this._entry.compare(entry);
    }

    // update received for already included (falls within sort keys) entry
    updateEntry(entry) {
        this._entry = entry;
        return UpdateAction.Nothing();
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
    // TilesCollection contract above
}
