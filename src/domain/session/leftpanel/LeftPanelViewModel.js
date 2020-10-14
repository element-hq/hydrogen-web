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
        const {rooms} = options;
        this._roomTileViewModels = rooms.mapValues((room, emitChange) => {
            const isOpen = this.navigation.path.get("room")?.value === room.id;
            const vm = new RoomTileViewModel(this.childOptions({
                isOpen,
                room,
                emitChange
            }));
            // need to also update the current vm here as
            // we can't call `_open` from the ctor as the map
            // is only populated when the view subscribes.
            if (isOpen) {
                this._currentTileVM?.close();
                this._currentTileVM = vm;
            }
            return vm;
        });
        this._roomListFilterMap = new ApplyMap(this._roomTileViewModels);
        this._roomList = this._roomListFilterMap.sortValues((a, b) => a.compare(b));
        this._currentTileVM = null;
        this._setupNavigation();
        this._closeUrl = this.urlRouter.urlForSegment("session");
    }

    get closeUrl() {
        return this._closeUrl;
    }

    _setupNavigation() {
        const roomObservable = this.navigation.observe("room");
        this.track(roomObservable.subscribe(roomId => this._open(roomId)));

        const gridObservable = this.navigation.observe("rooms");
        this.gridEnabled = !!gridObservable.get();
        this.track(gridObservable.subscribe(roomIds => {
            const changed = this.gridEnabled ^ !!roomIds;
            this.gridEnabled = !!roomIds;
            if (changed) {
                this.emitChange("gridEnabled");
            }
        }));
    }

    _open(roomId) {
        this._currentTileVM?.close();
        this._currentTileVM = null;
        if (roomId) {
            this._currentTileVM = this._roomTileViewModels.get(roomId);
            this._currentTileVM?.open();
        }
    }

    toggleGrid() {
        let url;
        if (this.gridEnabled) {
            url = this.urlRouter.disableGridUrl();
        } else {
            url = this.urlRouter.enableGridUrl();
        }
        url = this.urlRouter.applyUrl(url);
        this.urlRouter.history.pushUrl(url);
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
