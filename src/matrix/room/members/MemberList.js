/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ObservableMap} from "../../../observable";
import {RetainedValue} from "../../../utils/RetainedValue";

export class MemberList extends RetainedValue {
    constructor({members, closeCallback}) {
        super(closeCallback);
        this._members = new ObservableMap();
        for (const member of members) {
            this._members.add(member.userId, member);
        }
    }

    afterSync(memberChanges) {
        for (const [userId, memberChange] of memberChanges.entries()) {
            this._members.set(userId, memberChange.member);
        }
    }

    get members() {
        return this._members;
    }
}
