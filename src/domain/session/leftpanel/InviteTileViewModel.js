/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
