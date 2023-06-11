/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {UpdateAction} from "../UpdateAction.js";
import {ErrorReportViewModel} from "../../../../ErrorReportViewModel";
import {ITile, TileShape} from "./ITile";
import {SendStatus} from "../../../../../matrix/room/sending/PendingEvent.js";
import {DateTile} from "./DateTile";
import {Options as BaseOptions} from "../../../../ErrorReportViewModel";
import {EventEntry} from "../../../../../matrix/room/timeline/entries/EventEntry.js";
import type {RoomViewModel} from "../../RoomViewModel.js";
import type {Timeline} from "../../../../../matrix/room/timeline/Timeline.js";
import type {SegmentType} from "../../../../navigation/index.js";

export type Options<T extends object = SegmentType> = {
    roomVM: RoomViewModel; 
    timeline: Timeline;
} & BaseOptions<T>;

type EmitUpdate<T extends object = SegmentType> = (tile: SimpleTile<T>, params: any) => void; 


export abstract class SimpleTile<T extends object = SegmentType> extends ErrorReportViewModel<T, Options<T>> implements ITile {
    private _entry: EventEntry;
    private _date?: Date;
    private _needsDateSeparator: boolean = false;
    private _emitUpdate?: EmitUpdate<T>;
    
    constructor(entry: EventEntry, options: Options<T>) {
        super(options);
        this._entry = entry;
        this._date = this._entry.timestamp ? new Date(this._entry.timestamp) : undefined;
    }
    // view model props for all subclasses
    // hmmm, could also do instanceof ... ?
    // "gap" | "message" | "image" | ... ?
    abstract get shape(): TileShape;

    // don't show display name / avatar
    // probably only for BaseMessageTiles of some sort?
    get isContinuation() {
        return false;
    }

    get needsDateSeparator() {
        return this._needsDateSeparator;
    }

    createDateSeparator() {
        return new DateTile(this, this.childOptions({}));
    }

    _updateDateSeparator(prev: SimpleTile) {
        if (prev && prev._date && this._date) {
            this._needsDateSeparator = prev._date.getFullYear() !== this._date.getFullYear() ||
                prev._date.getMonth() !== this._date.getMonth() ||
                prev._date.getDate() !== this._date.getDate();
        } else {
            this._needsDateSeparator = !!this._date;
        }
    }

    get id() {
        return this._entry.asEventKey();
    }

    get eventId() {
        return this._entry.id;
    }

    get isPending() {
        return this._entry.isPending;
    }

    get isUnsent() {
        return this._entry.isPending && this._entry.pendingEvent.status !== SendStatus.Sent;
    }

    get canAbortSending() {
        return this._entry.isPending &&
            !this._entry.pendingEvent.hasStartedSending;
    }

    async abortSending(): Promise<void> {
        await this._entry.pendingEvent?.abort();
    }

    // TilesCollection contract below
    setUpdateEmit(emitUpdate?: EmitUpdate<T>) {
        this._emitUpdate = emitUpdate;
    }

    /** overrides the emitChange in ViewModel to also emit the update over the tiles collection */
    emitChange(changedProps) {
        if (this._emitUpdate) {
            // it can happen that after some network call
            // we switched away from the room and the response
            // comes in, triggering an emitChange in a tile that
            // has been disposed already (and hence the change
            // callback has been cleared by dispose) We should just ignore this.
            this._emitUpdate(this, changedProps);
        }
        super.emitChange(changedProps);
    }

    get upperEntry() {
        return this._entry;
    }

    get lowerEntry() {
        return this._entry;
    }

    get comparisonIsNotCommutative() {
        return false;
    }

    compare(tile: SimpleTile<T>) {
        if (tile.comparisonIsNotCommutative) {
            return -tile.compare(this);
        } else {
            return this.upperEntry.compare(tile.upperEntry);
        }
    }

    compareEntry(entry: EventEntry) {
        return this._entry.compare(entry);
    }

    // update received for already included (falls within sort keys) entry
    updateEntry(entry, param) {
        const renderedAsRedacted = this.shape === "redacted";
        if (!entry.isGap && entry.isRedacted !== renderedAsRedacted) {
            // recreate the tile if the entry becomes redacted
            return UpdateAction.Replace("shape");
        } else {
            this._entry = entry;
            return UpdateAction.Update(param);
        }
    }

    // return whether the tile should be removed
    // as SimpleTile only has one entry, the tile should be removed
    removeEntry(/*entry*/) {
        return true;
    }

    // SimpleTile can only contain 1 entry
    tryIncludeEntry() {
        return false;
    }
    // let item know it has a new sibling
    updatePreviousSibling(prev) {
        if (prev?.shape !== TileShape.DateHeader) {
            this._updateDateSeparator(prev);
        }
    }

    // let item know it has a new sibling
    updateNextSibling(/*next*/) {
    
    }

    notifyVisible() {}

    dispose() {
        this.setUpdateEmit(undefined);
        super.dispose();
    }
    // TilesCollection contract above

    get _room() {
        return this._roomVM.room;
    }

    get _roomVM() {
        return this.options.roomVM;
    }

    get _timeline() {
        return this.options.timeline;
    }

    get _powerLevels() {
        return this._timeline.powerLevels;
    }

    get _ownMember() {
        return this.options.timeline.me;
    }

    get displayName() {
        return this._entry.displayName || this.sender;
    }

    get sender() {
        return this._entry.sender;
    }
}


export function tests() {
    return {
        "needsDateSeparator is false when previous sibling is for same date": assert => {
            const fridayEntry = new EventEntry({
                event: {
                    origin_server_ts: 1669376446222,
                    type: "m.room.message",
                    content: {}
                }
            }, undefined);
            const thursdayEntry = new EventEntry({
                event: {
                    origin_server_ts: fridayEntry.timestamp - (60 * 60 * 8 * 1000),
                    type: "m.room.message",
                    content: {}
                }
            }, undefined);
            //@ts-ignore
            const fridayTile = new SimpleTile(fridayEntry, {});
            //@ts-ignore
            const thursdayTile = new SimpleTile(thursdayEntry, {});
            assert.equal(fridayTile.needsDateSeparator, false);
            fridayTile.updatePreviousSibling(thursdayTile);
            assert.equal(fridayTile.needsDateSeparator, false);
        },
        "needsDateSeparator is true when previous sibling is for different date": assert => {
            const fridayEntry = new EventEntry({
                event: {
                    origin_server_ts: 1669376446222,
                    type: "m.room.message",
                    content: {}
                }
            }, undefined);
            const thursdayEntry = new EventEntry({
                event: {
                    origin_server_ts: fridayEntry.timestamp - (60 * 60 * 24 * 1000),
                    type: "m.room.message",
                    content: {}
                }
            }, undefined);
            //@ts-ignore
            const fridayTile = new SimpleTile(fridayEntry, {});
            //@ts-ignore
            const thursdayTile = new SimpleTile(thursdayEntry, {});
            assert.equal(fridayTile.needsDateSeparator, false);
            fridayTile.updatePreviousSibling(thursdayTile);
            assert.equal(fridayTile.needsDateSeparator, true);
        },
        "needsDateSeparator is true when previous sibling is undefined": assert => {
            const fridayEntry = new EventEntry({
                event: {
                    origin_server_ts: 1669376446222,
                    type: "m.room.message",
                    content: {}
                }
            }, undefined);
            //@ts-ignore
            const fridayTile = new SimpleTile(fridayEntry, {});
            assert.equal(fridayTile.needsDateSeparator, false);
            fridayTile.updatePreviousSibling(undefined);
            assert.equal(fridayTile.needsDateSeparator, true);
        },
    }
}
