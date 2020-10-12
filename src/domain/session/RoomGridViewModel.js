/*
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

import {ViewModel} from "../ViewModel.js";

export class RoomGridViewModel extends ViewModel {
    constructor(options) {
        super(options);

        this._width = options.width;
        this._height = options.height;
        this._createRoomViewModel = options.createRoomViewModel;

        this._selectedIndex = 0;
        this._viewModels = (options.roomIds || []).map(roomId => {
            if (roomId) {
                const vm = this._createRoomViewModel(roomId);
                if (vm) {
                    return this.track(vm);
                }
            }
        });
        this._setupNavigation();
    }

    _setupNavigation() {
        const focusTileIndex = this.navigation.observe("empty-grid-tile");
        this.track(focusTileIndex.subscribe(index => {
            if (typeof index === "number") {
                this._setFocusIndex(index);
            }
        }));
        if (typeof focusTileIndex.get() === "number") {
            this._selectedIndex = focusTileIndex.get();
        }

        const focusedRoom = this.navigation.get("room");
        this.track(focusedRoom.subscribe(roomId => {
            if (roomId) {
                this._openRoom(roomId);
            }
        }));
        if (focusedRoom.get()) {
            const index = this._viewModels.findIndex(vm => vm && vm.id === focusedRoom.get());
            if (index >= 0) {
                this._selectedIndex = index;
            }
        }
    }

    roomViewModelAt(i) {
        return this._viewModels[i];
    }

    get focusIndex() {
        return this._selectedIndex;
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    focusTile(index) {
        if (index === this._selectedIndex) {
            return;
        }
        let path = this.navigation.path;
        const vm = this._viewModels[index];
        if (vm) {
            path = path.with(this.navigation.segment("room", vm.id));
        } else {
            path = path.with(this.navigation.segment("empty-grid-tile", index));
        }
        let url = this.urlRouter.urlForPath(path);
        url = this.urlRouter.applyUrl(url);
        this.urlRouter.history.pushUrl(url);
    }

    /** called from SessionViewModel */
    setRoomIds(roomIds) {
        let changed = false;
        const len = this._height * this._width;
        for (let i = 0; i < len; i += 1) {
            const newId = roomIds[i];
            const vm = this._viewModels[i];
            if (newId && !vm) {
                this._viewModels[i] = this.track(this._createRoomViewModel(newId));
                changed = true;
            } else if (newId !== vm?.id) {
                this._viewModels[i] = this.disposeTracked(this._viewModels[i]);
                if (newId) {
                    this._viewModels[i] = this.track(this._createRoomViewModel(newId));
                }
                changed = true;
            }
        }
        if (changed) {
            this.emitChange();
        }
    }

    /** called from SessionViewModel */
    transferRoomViewModel(index, roomVM) {
        const oldVM = this._viewModels[index];
        this.disposeTracked(oldVM);
        this._viewModels[index] = this.track(roomVM);
    }
    
    /** called from SessionViewModel */
    releaseRoomViewModel(roomId) {
        const index = this._viewModels.findIndex(vm => vm.id === roomId);
        if (index !== -1) {
            const vm = this._viewModels[index];
            this.untrack(vm);
            this._viewModels[index] = null;
            return vm;
        }
    }

    _setFocusIndex(idx) {
        if (idx === this._selectedIndex || idx >= (this._width * this._height)) {
            return;
        }
        this._selectedIndex = idx;
        const vm = this._viewModels[this._selectedIndex];
        vm?.focus();
        this.emitChange("focusedIndex");
    }

    _setFocusRoom(roomId) {
        const index = this._viewModels.findIndex(vm => vm.id === roomId);
        if (index >= 0) {
            this._setFocusIndex(index);
            return true;
        }
        return false;
    }

    _openRoom(roomId) {
        if (!this._setFocusRoom(roomId)) {
            // replace vm at focused index
            const vm = this._viewModels[this._selectedIndex];
            if (vm) {
                this.disposeTracked(vm);
            }
            this._viewModels[this._selectedIndex] = this.track(this._createRoomViewModel(roomId));
            this.emitChange();
        }
    }
}
