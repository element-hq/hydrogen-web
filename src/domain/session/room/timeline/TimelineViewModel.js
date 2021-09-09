/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
import {TilesCollection} from "./TilesCollection.js";
import {ViewModel} from "../../../ViewModel.js";



export class TimelineViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {timeline, tilesCreator} = options;
        this._timeline = this.track(timeline);
        this._tiles = new TilesCollection(timeline.entries, tilesCreator);
        this._startTile = null;
        this._endTile = null;
        this._topLoadingPromise = null;
        this._bottomLoadingPromise = null;
        this._requestedStartTile = null;
        this._requestedEndTile = null;
        this._requestScheduled = false;
    }

    /** if this.tiles is empty, call this with undefined for both startTile and endTile */
    setVisibleTileRange(startTile, endTile) {
        this._requestedStartTile = startTile;
        this._requestedEndTile = endTile;
        if (!this._requestScheduled) {
            Promise.resolve().then(() => {
                this._setVisibleTileRange(this._requestedStartTile, this._requestedEndTile);
                this._requestScheduled = false;
            });
            this._requestScheduled = true;
        }
    }

    _setVisibleTileRange(startTile, endTile) {
        let loadTop;
        if (startTile && endTile) {
            // old tiles could have been removed from tilescollection once we support unloading
            this._startTile = startTile;
            this._endTile = endTile;
            const startIndex = this._tiles.getTileIndex(this._startTile);
            const endIndex = this._tiles.getTileIndex(this._endTile);
            for (const tile of this._tiles.sliceIterator(startIndex, endIndex)) {
                tile.notifyVisible();
            }
            loadTop = startIndex < 5;
            console.log("got tiles", startIndex, endIndex, loadTop);
        } else {
            loadTop = true;
            console.log("no tiles, load more at top");
        }

        if (loadTop && !this._topLoadingPromise) {
            this._topLoadingPromise = this._timeline.loadAtTop(10).then(() => {
                this._topLoadingPromise = null;
                // check if more items need to be loaded by recursing
                this.setVisibleTileRange(this._startTile, this._endTile);
            });
        } else if (loadTop) {
            console.log("loadTop is true but already loading");
        }
    }

    get tiles() {
        return this._tiles;
    }
}
