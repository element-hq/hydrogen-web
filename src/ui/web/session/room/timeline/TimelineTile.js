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

import {tag} from "../../../general/html.js";

export class TimelineTile {
    constructor(tileVM) {
        this._tileVM = tileVM;
        this._root = null;
    }

    root() {
        return this._root;
    }

    mount() {
        this._root = renderTile(this._tileVM);
        return this._root;
    }

    unmount() {}

    update(vm, paramName) {
    }
}

function renderTile(tile) {
    switch (tile.shape) {
        case "message":
            return tag.li([tag.strong(tile.internalId+" "), tile.label]);
        case "announcement":
            return tag.li([tag.strong(tile.internalId+" "), tile.announcement]);
        default:
            return tag.li([tag.strong(tile.internalId+" "), "unknown tile shape: " + tile.shape]);
    }
}
