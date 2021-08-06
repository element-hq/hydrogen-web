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

import {SimpleTile} from "./SimpleTile.js";
import {UpdateAction} from "../UpdateAction.js";

export class GapTile extends SimpleTile {
    constructor(options) {
        super(options);
        this._loading = false;
        this._error = null;
    }

    async fill() {
        // prevent doing this twice
        if (!this._loading) {
            this._loading = true;
            this.emitChange("isLoading");
            try {
                await this._room.fillGap(this._entry, 10);
            } catch (err) {
                console.error(`room.fillGap(): ${err.message}:\n${err.stack}`);
                this._error = err;
                this.emitChange("error");
                // rethrow so caller of this method
                // knows not to keep calling this for now
                throw err;
            } finally {
                this._loading = false;
                this.emitChange("isLoading");
            }
        }
        // edgeReached will have been updated by fillGap
        return this._entry.edgeReached;
    }

    updateEntry(entry, params) {
        super.updateEntry(entry, params);
        if (!entry.isGap) {
            return UpdateAction.Remove();
        } else {
            return UpdateAction.Nothing();
        }
    }

    get shape() {
        return "gap";
    }

    get isLoading() {
        return this._loading;
    }

    get error() {
        if (this._error) {
            const dir = this._entry.prev_batch ? "previous" : "next";
            return `Could not load ${dir} messages: ${this._error.message}`;
        }
        return null;
    }
}

import {FragmentBoundaryEntry} from "../../../../../matrix/room/timeline/entries/FragmentBoundaryEntry.js";
export function tests() {
    return {
        "uses updated token to fill": async assert => {
            let currentToken = 5;
            const fragment = {
                id: 0,
                previousToken: currentToken,
                roomId: "!abc"
            };
            const room = {
                async fillGap(entry) {
                    assert.equal(entry.token, currentToken);
                    currentToken += 1;
                    const newEntry = entry.withUpdatedFragment(Object.assign({}, fragment, {previousToken: currentToken}));
                    tile.updateEntry(newEntry);
                }
            };
            const tile = new GapTile({entry: new FragmentBoundaryEntry(fragment, true), roomVM: {room}});
            await tile.fill();
            await tile.fill();
            await tile.fill();
            assert.equal(currentToken, 8);
        }
    }
}
