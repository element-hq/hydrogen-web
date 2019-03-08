export default class SimpleTile {
    constructor(entry) {
        this._entry = entry;
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

    get upperSortKey() {
        return this._entry.sortKey;
    }

    get lowerSortKey() {
        return this._entry.sortKey;
    }

    // TilesCollection contract
    compareSortKey(key) {
        return this._entry.sortKey.compare(key);
    }

    // update received for already included (falls within sort keys) entry
    updateEntry(entry) {

    }

    // simple entry can only contain 1 entry
    tryIncludeEntry() {
        return false;
    }
    // let item know it has a new sibling
    updatePreviousSibling(prev) {

    }

    // let item know it has a new sibling
    updateNextSibling(next) {
    
    }
}
