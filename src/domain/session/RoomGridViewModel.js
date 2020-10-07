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

    _posToIdx(x, y) {
        return (y * this.width) + x;
    }

    _idxToX(idx) {
        return idx % this.width;
    }

    _idxToY(idx) {
        return Math.floor(idx / this.width);
    }

    roomViewModelAt(x, y) {
        return this._viewModels[this._posToIdx(x, y)]?.vm;
    }

    get focusX() {
        return this._idxToX(this._selectedIndex);
    }

    get focusY() {
        return this._idxToY(this._selectedIndex);
    }

    isFocusAt(x, y) {
        return this._posToIdx(x, y) === this._selectedIndex;
    }

    setFocusAt(x, y) {
        this._setFocusedIndex(this._posToIdx(x, y));
    }

    _setFocusedIndex(idx) {
        if (idx === this._selectedIndex) {
            return;
        }
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
    tryFocusRoom(roomId) {
        const index = this._viewModels.findIndex(vms => vms?.vm._room.id === roomId);
        if (index >= 0) {
            this._setFocusedIndex(index);
            return true;
        }
        return false;
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
