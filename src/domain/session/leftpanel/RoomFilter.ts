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
import {RoomTileViewModel} from "./RoomTileViewModel";

export class RoomFilter {
    private _parts: string[];

    constructor(query: string) {
        this._parts = query.split(" ").map(s => s.toLowerCase().trim());
    }

    matches(roomTileVM: RoomTileViewModel): boolean {
        const name = roomTileVM.name.toLowerCase();
        return this._parts.every(p => name.includes(p));
    }
}
