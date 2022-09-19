/*
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
import {Invite} from "../../../matrix/room/Invite";
import {Instance as nullLogger} from "../../../logging/NullLogger";

type Options = {invite: Invite} & ViewModelOptions;

export class InviteTileViewModel extends BaseTileViewModel {
    private _invite: Invite;
    private _url: string;

    constructor(options: Options) {
        super(options);
        const {invite} = options;
        this._invite = invite;
        this._url = this.urlCreator.openRoomActionUrl(this._invite.id);
    }

    get busy(): boolean { return this._invite.accepting || this._invite.rejecting; }
    get kind(): Kind { return "invite"; }
    get url(): string { return this._url; }
    get name(): string { return this._invite.name; }
    get isHighlighted(): boolean { return true; }
    get isUnread(): boolean { return true; }
    get badgeCount(): string { return this.i18n`!`; }
    get _avatarSource(): AvatarSource { return this._invite; }

    /** very important that sorting order is stable and that comparing
     * to itself always returns 0, otherwise SortedMapList will
     * remove the wrong children, etc ... */
    compare(other: InviteTileViewModel): number {
        const parentComparison = super.compare(other);
        if (parentComparison !== 0) {
            return parentComparison;
        }
        const timeDiff = other._invite.timestamp - this._invite.timestamp;
        if (timeDiff !== 0) {
            return timeDiff;
        }
        return comparePrimitive(this._invite.id, other._invite.id);
    }
}

import {Navigation} from "../../navigation/Navigation";
import {TestURLRouter} from './common'
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tests() {
    return {
        "test compare with timestamp": (assert): void => {
            const vm1 = new InviteTileViewModel({
                invite: { timestamp: 500, id: "1" },
                urlCreator: TestURLRouter,
                platform: undefined,
                logger: nullLogger,
                navigation: new Navigation(() => true),
            });
            const vm2 = new InviteTileViewModel({
                invite: { timestamp: 250, id: "2" },
                urlCreator: TestURLRouter,
                platform: undefined,
                logger: nullLogger,
                navigation: new Navigation(() => true),
            });
            assert(vm1.compare(vm2) < 0);
            assert(vm2.compare(vm1) > 0);
            assert.equal(vm1.compare(vm1), 0);
        },
    };
}
