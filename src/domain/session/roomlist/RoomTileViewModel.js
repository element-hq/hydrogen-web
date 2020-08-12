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

import {avatarInitials} from "../avatar.js";
import {ViewModel} from "../../ViewModel.js";

export class RoomTileViewModel extends ViewModel {
    // we use callbacks to parent VM instead of emit because
    // it would be annoying to keep track of subscriptions in
    // parent for all RoomTileViewModels
    // emitUpdate is ObservableMap/ObservableList update mechanism
    constructor(options) {
        super(options);
        const {room, emitOpen} = options;
        this._room = room;
        this._emitOpen = emitOpen;
        this._isOpen = false;
    }

    // called by parent for now (later should integrate with router)
    close() {
        if (this._isOpen) {
            this._isOpen = false;
            this.emitChange("isOpen");
        }
    }

    open() {
        this._isOpen = true;
        this.emitChange("isOpen");
        this._emitOpen(this._room, this);
    }

    compare(other) {
        // sort by name for now
        return this._room.name.localeCompare(other._room.name);
    }

    get isOpen() {
        return this._isOpen;
    }

    get name() {
        return this._room.name;
    }

    get avatarInitials() {
        return avatarInitials(this._room.name);
    }
}
