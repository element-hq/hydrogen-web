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
    // probably only for MessageTiles of some sort?
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
        return this._entry.isPending && this._entry.status !== SendStatus.Sent;
    }

    abortSending() {
        this._entry.pendingEvent?.abort();
    }

    // TilesCollection contract below
    setUpdateEmit(emitUpdate) {
        this.updateOptions({emitChange: paramName => {
            if (emitUpdate) {
                emitUpdate(this, paramName);
            } else {
                console.trace("Tile is emitting event after being disposed");
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
    updateEntry(entry, params) {
        this._entry = entry;
        return UpdateAction.Update(params);
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

    dispose() {
        this.setUpdateEmit(null);
        super.dispose();
    }
    // TilesCollection contract above
}
