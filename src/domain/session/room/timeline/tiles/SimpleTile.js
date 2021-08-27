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
import {ViewModel} from "../../../../ViewModel.js";
import {SendStatus} from "../../../../../matrix/room/sending/PendingEvent.js";

export class SimpleTile extends ViewModel {
    constructor(options) {
        super(options);
        this._entry = options.entry;
    }
    // view model props for all subclasses
    // hmmm, could also do instanceof ... ?
    get shape() {
        return null;
        // "gap" | "message" | "image" | ... ?
    }

    // don't show display name / avatar
    // probably only for BaseMessageTiles of some sort?
    get isContinuation() {
        return false;
    }

    get hasDateSeparator() {
        return false;
    }

    get internalId() {
        return this._entry.asEventKey().toString();
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

    abortSending() {
        this._entry.pendingEvent?.abort();
    }

    // TilesCollection contract below
    setUpdateEmit(emitUpdate) {
        this.updateOptions({emitChange: paramName => {
            // it can happen that after some network call
            // we switched away from the room and the response
            // comes in, triggering an emitChange in a tile that
            // has been disposed already (and hence the change
            // callback has been cleared by dispose) We should just ignore this.
            if (emitUpdate) {
                emitUpdate(this, paramName);
            }
        }});
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
    updatePreviousSibling(/*prev*/) {

    }

    // let item know it has a new sibling
    updateNextSibling(/*next*/) {
    
    }

    dispose() {
        this.setUpdateEmit(null);
        super.dispose();
    }
    // TilesCollection contract above

    get _room() {
        return this._roomVM.room;
    }

    get _roomVM() {
        return this._options.roomVM;
    }

    get _timeline() {
        return this._options.timeline;
    }

    get _powerLevels() {
        return this._timeline.powerLevels;
    }

    get _ownMember() {
        return this._options.timeline.me;
    }
}
