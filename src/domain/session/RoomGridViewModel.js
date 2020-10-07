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
        this._selectedIndex = 0;
        this._viewModels = [];
    }

    roomViewModelAt(idx) {
        return this._viewModels[idx]?.vm;
    }

    get focusedIndex() {
        return this._selectedIndex;
    }

    setFocusedIndex(idx) {
        const oldItem = this._viewModels[this._selectedIndex];
        oldItem?.tileVM?.close();
        this._selectedIndex = idx;
        const newItem = this._viewModels[this._selectedIndex];
        if (newItem) {
            newItem.vm.focus();
            newItem.tileVM.open();
        }
        this.emitChange("focusedIndex");
    }
    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    /**
     * Sets a pair of room and room tile view models at the current index
     * @param {RoomViewModel} vm
     * @param {RoomTileViewModel} tileVM
     * @package
     */
    setRoomViewModel(vm, tileVM) {
        const old = this._viewModels[this._selectedIndex];
        this.disposeTracked(old?.vm);
        old?.tileVM?.close();
        this._viewModels[this._selectedIndex] = {vm: this.track(vm), tileVM};
        this.emitChange(`${this._selectedIndex}`);
    }

    /**
     * @package
     */
    hasRoomId(roomId) {
        return this._viewModels.some(vms => vms?.vm._room.id === roomId);
    }
    
    /**
     * Returns the first set of room and room tile vm,
     * and untracking them so they are not owned by this view model anymore.
     * @package
     */
    getAndUntrackFirst() {
        for (const item of this._viewModels) {
            if (item) {
                this.untrack(item.vm);
                return item;
            }
        }
    }
}
