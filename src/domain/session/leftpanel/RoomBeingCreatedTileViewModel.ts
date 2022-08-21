/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import {BaseTileViewModel, Kind, AvatarSource} from "./BaseTileViewModel";
import {comparePrimitive} from "./common";
import {Options as ViewModelOptions} from "../../ViewModel";
import {RoomBeingCreated} from "../../../matrix/room/RoomBeingCreated.js";
import {Navigation} from "../../navigation/Navigation";
import type {Platform} from "../../../platform/web/Platform";
import type {ILogger} from "../../../logging/types";


type Options = {roomBeingCreated: RoomBeingCreated} & ViewModelOptions;

export class RoomBeingCreatedTileViewModel extends BaseTileViewModel {
    private _roomBeingCreated: RoomBeingCreated;
    private _url: string;

    constructor(options: Options) {
        super(options);
        const {roomBeingCreated} = options;
        this._roomBeingCreated = roomBeingCreated;
        this._url = this.urlCreator.openRoomActionUrl(this._roomBeingCreated.id);
    }

    get busy(): boolean { return !this._roomBeingCreated.error; }
    get kind(): Kind { return "roomBeingCreated"; }
    get isHighlighted(): boolean { return !this.busy; }
    get badgeCount(): string | false { return !this.busy && this.i18n`Failed`; }
    get url(): string { return this._url; }
    get name(): string { return this._roomBeingCreated.name; }
    get _avatarSource(): AvatarSource { return this._roomBeingCreated; }

    /** very important that sorting order is stable and that comparing
     * to itself always returns 0, otherwise SortedMapList will
     * remove the wrong children, etc ... */
    compare(other: RoomBeingCreatedTileViewModel): number {
        const parentCmp = super.compare(other);
        if (parentCmp !== 0) {
            return parentCmp;
        }
        const nameCmp = comparePrimitive(this.name, other.name);
        if (nameCmp === 0) {
            return comparePrimitive(this._roomBeingCreated.id, other._roomBeingCreated.id);
        } else {
            return nameCmp;
        }
    }

    avatarUrl(size: number): string | null {
        // allow blob url which doesn't need mxc => http resolution
        return this._roomBeingCreated.avatarBlobUrl ?? super.avatarUrl(size);
    }
}


import {TestURLRouter} from './common';
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    return {
        "test compare with names": (assert): void => {
            const vm1 = new RoomBeingCreatedTileViewModel({
                roomBeingCreated: { name: "A", id: "1" } as RoomBeingCreated,
                urlCreator: TestURLRouter,
                platform: {} as Platform,
                logger: {} as ILogger,
                navigation: new Navigation(() => true),
            });
            const vm2 = new RoomBeingCreatedTileViewModel({
                roomBeingCreated: { name: "B", id: "2" } as RoomBeingCreated,
                urlCreator: TestURLRouter,
                platform: {} as Platform,
                logger: {} as ILogger,
                navigation: new Navigation(() => true),
            });
            assert(vm1.compare(vm2) < 0);
            assert(vm2.compare(vm1) > 0);
            assert.equal(vm1.compare(vm1), 0);
        },
    };
}
