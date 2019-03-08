import BaseObservableList from "../../../../observable/list/BaseObservableList.js";

// maps 1..n entries to 0..1 tile. Entries are what is stored in the timeline, either an event or gap
export default class TilesCollection extends BaseObservableList {
    constructor(entries, tileCreator) {
        super();
        this._entries = entries;
        this._tiles = null;
        this._entrySubscription = null;
        this._tileCreator = tileCreator;
    }

    onSubscribeFirst() {
        this._entrySubscription = this._entries.subscribe(this);
        this._populateTiles();
    }

    _populateTiles() {
        this._tiles = [];
        let currentTile = null;
        for (let entry of this._entries) {
            if (!currentTile || !currentTile.tryIncludeEntry(entry)) {
                currentTile = this._tileCreator(entry);
                this._tiles.push(currentTile);
            }
        }
        let prevTile = null;
        for (let tile of this._tiles) {
            if (prevTile) {
                prevTile.updateNextSibling(tile);
            }
            tile.updatePreviousSibling(prevTile);
            prevTile = tile;
        }
        if (prevTile) {
            prevTile.updateNextSibling(null);
        }
    }

    _findTileIndex(sortKey) {
        return sortedIndex(this._tiles, sortKey, (key, tile) => {
            return tile.compareSortKey(key);
        });
    }

    onUnsubscribeLast() {
        this._entrySubscription = this._entrySubscription();
        this._tiles = null;
    }

    onReset() {
        // if TileViewModel were disposable, dispose here, or is that for views to do? views I suppose ...
        this._buildInitialTiles();
        this.emitReset();
    }

    onAdd(index, value) {
        // find position by sort key
        // ask siblings to be included? both? yes, twice: a (insert c here) b, ask a(c), if yes ask b(a), else ask b(c)? if yes then b(a)?
    }

    onUpdate(index, value, params) {
        // outcomes here can be
        //   tiles should be removed (got redacted and we don't want it in the timeline)
        //   tile should be added where there was none before ... ?
        //   entry should get it's own tile now
        //   merge with neighbours? ... hard to imagine for this use case ...

        // also emit update for tile
    }

    onRemove(index, value) {
        // find tile, if any
        // remove entry from tile
        // emit update or remove (if empty now) on tile
    }

    onMove(fromIdx, toIdx, value) {
        // this ... cannot happen in the timeline?
        // should be sorted by sortKey and sortKey is immutable
    }

    [Symbol.iterator]() {
        return this._tiles.values();
    }
}
