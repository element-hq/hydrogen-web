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

import {BaseTileViewModel} from "./BaseTileViewModel.js";
import {comparePrimitive} from "./common";

export class InviteTileViewModel extends BaseTileViewModel {
    constructor(options) {
        super(options);
        const {invite} = options;
        this._invite = invite;
        this._url = this.urlRouter.openRoomActionUrl(this._invite.id);
    }

    get busy() { return this._invite.accepting || this._invite.rejecting; }
    get kind() { return "invite"; }
    get url() { return this._url; }
    get name() { return this._invite.name; }
    get isHighlighted() { return true; }
    get isUnread() { return true; }
    get badgeCount() { return this.i18n`!`; }
    get _avatarSource() { return this._invite; }

    /** very important that sorting order is stable and that comparing
     * to itself always returns 0, otherwise SortedMapList will
     * remove the wrong children, etc ... */
    compare(other) {
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

export function tests() {
    return {
        "test compare with timestamp": assert => {
            const urlRouter = {openRoomActionUrl() { return "";}}
            const vm1 = new InviteTileViewModel({invite: {timestamp: 500, id: "1"}, urlRouter});
            const vm2 = new InviteTileViewModel({invite: {timestamp: 250, id: "2"}, urlRouter});
            assert(vm1.compare(vm2) < 0);
            assert(vm2.compare(vm1) > 0);
            assert.equal(vm1.compare(vm1), 0);
        },
    }
}
