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

export class RoomTileViewModel {
    // we use callbacks to parent VM instead of emit because
    // it would be annoying to keep track of subscriptions in
    // parent for all RoomTileViewModels
    // emitUpdate is ObservableMap/ObservableList update mechanism
    constructor({room, emitUpdate, emitOpen}) {
        this._room = room;
        this._emitUpdate = emitUpdate;
        this._emitOpen = emitOpen;
    }

    open() {
        this._emitOpen(this._room);
    }

    compare(other) {
        // sort by name for now
        return this._room.name.localeCompare(other._room.name);
    }

    get name() {
        return this._room.name;
    }

    get avatarInitials() {
        return avatarInitials(this._room.name);
    }
}
