/*
need better naming, but
entry = event or gap from matrix layer
tile = item on visual timeline like event, date separator?, group of joined events


shall we put date separators as marker in EventViewItem or separate item? binary search will be complicated ...


pagination ...

on the timeline viewmodel (containing the TilesCollection?) we'll have a method to (un)load a tail or head of
the timeline (counted in tiles), which results to a range in sortKeys we want on the screen. We pass that range
to the room timeline, which unload entries from memory.
when loading, it just reads events from a sortkey backwards or forwards...
*/
import TilesCollection from "./TilesCollection.js";
import tilesCreator from "./tilesCreator.js";

export default class TimelineViewModel {
    constructor(timeline) {
        this._timeline = timeline;
        // once we support sending messages we could do
        // timeline.entries.concat(timeline.pendingEvents)
        // for an ObservableList that also contains local echos
        this._tiles = new TilesCollection(timeline.entries, tilesCreator({timeline}));
    }

    // doesn't fill gaps, only loads stored entries/tiles
    loadAtTop() {
        // load 100 entries, which may result in 0..100 tiles
        return this._timeline.loadAtTop(100);
    }

    unloadAtTop(tileAmount) {
        // get lowerSortKey for tile at index tileAmount - 1
        // tell timeline to unload till there (included given key)
    }

    loadAtBottom() {

    }

    unloadAtBottom(tileAmount) {
        // get upperSortKey for tile at index tiles.length - tileAmount
        // tell timeline to unload till there (included given key)
    }

    get tiles() {
        return this._tiles;
    }
}
