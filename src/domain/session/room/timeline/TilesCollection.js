import BaseObservableList from "../../../../observable/list/BaseObservableList.js";
import sortedIndex from "../../../../utils/sortedIndex.js";

// maps 1..n entries to 0..1 tile. Entries are what is stored in the timeline, either an event or fragmentboundary
export default class TilesCollection extends BaseObservableList {
    constructor(entries, tileCreator) {
        super();
        this._entries = entries;
        this._tiles = null;
        this._entrySubscription = null;
        this._tileCreator = tileCreator;
        this._emitSpontanousUpdate = this._emitSpontanousUpdate.bind(this);
    }

    _emitSpontanousUpdate(tile, params) {
        const entry = tile.lowerEntry;
        const tileIdx = this._findTileIdx(entry);
        this.emitUpdate(tileIdx, tile, params);
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
                currentTile = this._tileCreator(entry, this._emitSpontanousUpdate);
                if (currentTile) {
                    this._tiles.push(currentTile);
                }
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

    _findTileIdx(entry) {
        return sortedIndex(this._tiles, entry, (entry, tile) => {
            // negate result because we're switching the order of the params
            return -tile.compareEntry(entry);
        });
    }

    _findTileAtIdx(entry, idx) {
        const tile = this._getTileAtIdx(idx);
        if (tile && tile.compareEntry(entry) === 0) {
            return tile;
        }
    }

    _getTileAtIdx(tileIdx) {
        if (tileIdx >= 0 && tileIdx < this._tiles.length) {
            return this._tiles[tileIdx];
        }
        return null;
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

    onAdd(index, entry) {
        const tileIdx = this._findTileIdx(entry);
        const prevTile = this._getTileAtIdx(tileIdx - 1);
        if (prevTile && prevTile.tryIncludeEntry(entry)) {
            this.emitUpdate(tileIdx - 1, prevTile);
            return;
        }
        // not + 1 because this entry hasn't been added yet
        const nextTile = this._getTileAtIdx(tileIdx);
        if (nextTile && nextTile.tryIncludeEntry(entry)) {
            this.emitUpdate(tileIdx, nextTile);
            return;
        }

        const newTile = this._tileCreator(entry, this._emitSpontanousUpdate);
        if (newTile) {
            if (prevTile) {
                prevTile.updateNextSibling(newTile);
                newTile.updatePreviousSibling(prevTile);
            }
            if (nextTile) {
                newTile.updateNextSibling(nextTile);
                nextTile.updatePreviousSibling(newTile);
            }
            this._tiles.splice(tileIdx, 0, newTile);
            this.emitAdd(tileIdx, newTile);
        }
        // find position by sort key
        // ask siblings to be included? both? yes, twice: a (insert c here) b, ask a(c), if yes ask b(a), else ask b(c)? if yes then b(a)?
    }

    onUpdate(index, entry, params) {
        const tileIdx = this._findTileIdx(entry);
        const tile = this._findTileAtIdx(entry, tileIdx);
        if (tile) {
            const action = tile.updateEntry(entry, params);
            if (action.shouldRemove) {
                this._removeTile(tileIdx, tile);
            }
            if (action.shouldUpdate) {
                this.emitUpdate(tileIdx, tile, action.updateParams);
            }
        }
        // technically we should handle adding a tile here as well
        // in case before we didn't have a tile for it but now we do
        // but in reality we don't have this use case as the type and msgtype
        // doesn't change. Decryption maybe is the exception?


        // outcomes here can be
        //   tiles should be removed (got redacted and we don't want it in the timeline)
        //   tile should be added where there was none before ... ?
        //   entry should get it's own tile now
        //   merge with neighbours? ... hard to imagine use case for this  ...
    }

    _removeTile(tileIdx, tile) {
        const prevTile = this._getTileAtIdx(tileIdx - 1);
        const nextTile = this._getTileAtIdx(tileIdx + 1);
        this._tiles.splice(tileIdx, 1);
        prevTile && prevTile.updateNextSibling(nextTile);
        nextTile && nextTile.updatePreviousSibling(prevTile);
        this.emitRemove(tileIdx, tile);
    }

    // would also be called when unloading a part of the timeline
    onRemove(index, entry) {
        const tileIdx = this._findTileIdx(entry);
        const tile = this._findTileAtIdx(entry, tileIdx);
        if (tile) {
            const removeTile = tile.removeEntry(entry);
            if (removeTile) {
                this._removeTile(tileIdx, tile);
            } else {
                this.emitUpdate(tileIdx, tile);
            }
        }
    }

    onMove(fromIdx, toIdx, value) {
        // this ... cannot happen in the timeline?
        // perhaps we can use this event to support a local echo (in a different fragment)
        // to be moved to the key of the remote echo, so we don't loose state ... ?
    }

    [Symbol.iterator]() {
        return this._tiles.values();
    }

    get length() {
        return this._tiles.length;
    }
}

import ObservableArray from "../../../../observable/list/ObservableArray.js";
import UpdateAction from "./UpdateAction.js";

export function tests() {

    class TestTile {
        constructor(entry, update) {
            this.entry = entry;
            this.update = update;
        }
        tryIncludeEntry() {
            return false;
        }
        compareEntry(b) {
            return this.entry.n - b.n;
        }
        removeEntry() {
            return true;
        }
        get upperEntry() {
            return this.entry;
        }

        get lowerEntry() {
            return this.entry;
        }
        updateNextSibling() {}
        updatePreviousSibling() {}
        updateEntry() {
            return UpdateAction.Nothing;
        }
    }

    return {
        "don't emit update before add": assert => {
            class UpdateOnSiblingTile extends TestTile {
                updateNextSibling() {
                    // this happens with isContinuation
                    this.update(this, "next");
                }
                updatePreviousSibling() {
                    // this happens with isContinuation
                    this.update(this, "previous");
                }
            }
            const entries = new ObservableArray([{n: 5}, {n: 10}]);
            const tiles = new TilesCollection(entries, (e, u) => new UpdateOnSiblingTile(e, u));
            let receivedAdd = false;
            tiles.subscribe({
                onAdd(idx, tile) {
                    assert(tile.entry.n, 7);
                    receivedAdd = true;
                },
                onUpdate(idx, tile) {
                    assert(tile.entry.n, 7);
                    assert(!receivedAdd, "receiving update before add");
                }
            });
            entries.insert(1, {n: 7});
            assert(receivedAdd);
        },
    }
}
