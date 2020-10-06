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

import {ViewModel} from "../../ViewModel.js";
import {RoomTileViewModel} from "./RoomTileViewModel.js";
import {RoomFilter} from "./RoomFilter.js";
import {ApplyMap} from "../../../observable/map/ApplyMap.js";

export class LeftPanelViewModel extends ViewModel {
    constructor(options) {
        super(options);
        const {rooms, openRoom} = options;
        const roomTileVMs = rooms.mapValues((room, emitChange) => {
            return new RoomTileViewModel({
                room,
                emitChange,
                emitOpen: openRoom
            });
        });
        this._roomListFilterMap = new ApplyMap(roomTileVMs);
        this._roomList = this._roomListFilterMap.sortValues((a, b) => a.compare(b));
    }

    get roomList() {
        return this._roomList;
    }

    clearFilter() {
        this._roomListFilterMap.setApply(null);
        this._roomListFilterMap.applyOnce((roomId, vm) => vm.hidden = false);
    }

    setFilter(query) {
        query = query.trim();
        if (query.length === 0) {
            this.clearFilter();
        } else {
            const filter = new RoomFilter(query);
            this._roomListFilterMap.setApply((roomId, vm) => {
                vm.hidden = !filter.matches(vm);
            });
        }
    }
}
