/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
import {ViewModel} from "../../../ViewModel";

export class TimelineViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {timeline, tileOptions} = options;
        this._timeline = this.track(timeline);
        this._tiles = new TilesCollection(timeline.entries, tileOptions);
        this._startTile = null;
        this._endTile = null;
        this._topLoadingPromise = null;
        this._requestedStartTile = null;
        this._requestedEndTile = null;
        this._requestScheduled = false;
        this._showJumpDown = false;
    }

    /** if this.tiles is empty, call this with undefined for both startTile and endTile */
    setVisibleTileRange(startTile, endTile) {
        // don't clear these once done as they are used to check
        // for more tiles once loadAtTop finishes
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
            for (const tile of this._tiles.sliceIterator(startIndex, endIndex + 1)) {
                tile.notifyVisible();
            }
            loadTop = startIndex < 10;
            this._setShowJumpDown(endIndex < (this._tiles.length - 1));
        } else {
            // tiles collection is empty, load more at top
            loadTop = true;
            this._setShowJumpDown(false);
        }

        if (loadTop && !this._topLoadingPromise) {
            this._topLoadingPromise = this._timeline.loadAtTop(10).then(hasReachedEnd => {
                this._topLoadingPromise = null;
                if (!hasReachedEnd) {
                    // check if more items need to be loaded by recursing
                    // use the requested start / end tile,
                    // so we don't end up overwriting a newly requested visible range here
                    this.setVisibleTileRange(this._requestedStartTile, this._requestedEndTile);
                }
            });
        }
    }

    get tiles() {
        return this._tiles;
    }

    _setShowJumpDown(show) {
        if (this._showJumpDown !== show) {
            this._showJumpDown = show;
            this.emitChange("showJumpDown");
        }
    }

    get showJumpDown() {
        return this._showJumpDown;
    }
}
