/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class RoomFilter {
    constructor(query) {
        this._parts = query.split(" ").map(s => s.toLowerCase().trim());
    }

    matches(roomTileVM) {
        const name = roomTileVM.name.toLowerCase();
        return this._parts.every(p => name.includes(p));
    }
}
