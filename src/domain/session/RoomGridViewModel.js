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

    roomViewModelAt(i) {
        return this._viewModels[i];
    }

    get focusIndex() {
        return this._selectedIndex;
    }

    setFocusIndex(idx) {
        if (idx === this._selectedIndex) {
            return;
        }
        this._selectedIndex = idx;
        const vm = this._viewModels[this._selectedIndex];
        vm?.focus();
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
     * @package
     */
    setRoomViewModel(vm) {
        const old = this._viewModels[this._selectedIndex];
        this.disposeTracked(old);
        this._viewModels[this._selectedIndex] = this.track(vm);
        this.emitChange(`${this._selectedIndex}`);
    }

    /**
     * @package
     */
    tryFocusRoom(roomId) {
        const index = this._viewModels.findIndex(vm => vm.id === roomId);
        if (index >= 0) {
            this.setFocusIndex(index);
            return true;
        }
        return false;
    }
    
    /**
     * Returns the first set of room vm,
     * and untracking it so it is not owned by this view model anymore.
     * @package
     */
    getAndUntrackFirst() {
        for (const vm of this._viewModels) {
            if (vm) {
                this.untrack(vm);
                return vm;
            }
        }
    }
}
