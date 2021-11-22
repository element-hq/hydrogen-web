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
    }

    get busy() {
        return false;
    }

    get kind() {
        return "placeholder";
    }

    compare(other) {
        return super.compare(other);
    }

    get name() {
        return "Placeholder";
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
