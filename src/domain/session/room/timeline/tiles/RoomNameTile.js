/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {SimpleTile} from "./SimpleTile";

export class RoomNameTile extends SimpleTile {
    
    get shape() {
        return "announcement";
    }

    get announcement() {
        const content = this._entry.content;
        return `${this._entry.displayName || this._entry.sender} named the room "${content?.name}"`
    }
}
