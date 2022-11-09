/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {BaseTileViewModel} from "./BaseTileViewModel.js";
import {comparePrimitive} from "./common";

export class RoomBeingCreatedTileViewModel extends BaseTileViewModel {
    constructor(options) {
        super(options);
        const {roomBeingCreated} = options;
        this._roomBeingCreated = roomBeingCreated;
        this._url = this.urlRouter.openRoomActionUrl(this._roomBeingCreated.id);
    }

    get busy() { return !this._roomBeingCreated.error; }
    get kind() { return "roomBeingCreated"; }
    get isHighlighted() { return !this.busy; }
    get badgeCount() { return !this.busy && this.i18n`Failed`; }
    get url() { return this._url; }
    get name() { return this._roomBeingCreated.name; }
    get _avatarSource() { return this._roomBeingCreated; }

    /** very important that sorting order is stable and that comparing
     * to itself always returns 0, otherwise SortedMapList will
     * remove the wrong children, etc ... */
    compare(other) {
        const parentCmp = super.compare(other);
        if (parentCmp !== 0) {
            return parentCmp;
        }
        const nameCmp = comparePrimitive(this.name, other.name);
        if (nameCmp === 0) {
            return comparePrimitive(this._roomBeingCreated.id, other._roomBeingCreated.id);
        } else {
            return nameCmp;
        }
    }

    avatarUrl(size) {
        // allow blob url which doesn't need mxc => http resolution
        return this._roomBeingCreated.avatarBlobUrl ?? super.avatarUrl(size);
    }
}

export function tests() {
    return {
        "test compare with names": assert => {
            const urlRouter = {openRoomActionUrl() { return "";}}
            const vm1 = new RoomBeingCreatedTileViewModel({roomBeingCreated: {name: "A", id: "1"}, urlRouter});
            const vm2 = new RoomBeingCreatedTileViewModel({roomBeingCreated: {name: "B", id: "2"}, urlRouter});
            assert(vm1.compare(vm2) < 0);
            assert(vm2.compare(vm1) > 0);
            assert.equal(vm1.compare(vm1), 0);
        },
    }
}
