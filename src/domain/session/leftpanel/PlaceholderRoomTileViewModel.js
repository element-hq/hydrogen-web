/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {getIdentifierColorNumber} from "../../avatar.js";
import {BaseTileViewModel} from "./BaseTileViewModel.js";

export class PlaceholderRoomTileViewModel extends BaseTileViewModel {
    constructor(options) {
        super(options);
        // Placeholder tiles can be sorted with Room tiles, so we need to ensure we have the same
        // fields else the comparison needs to take into account the kind().
        // We need a fake room so we can do compare(other) with RoomTileViewModels 
        const {room} = options;
        this._room = room;
    }

    get busy() {
        return false;
    }

    get kind() {
        return "placeholder";
    }

    compare(other) {
        if (other._room.index !== undefined) {
            return this._room.index > other._room.index ? 1 : -1;
        }
        return super.compare(other);
    }

    get name() {
        return "Placeholder " + this._room.index;
    }

    get avatarLetter() {
        return " ";
    }

    get avatarColorNumber() {
        return getIdentifierColorNumber("placeholder"); // TODO: randomise
    }

    avatarUrl(size) {
        return null;
    }

    get avatarTitle() {
        return "Placeholder";
    }
}
