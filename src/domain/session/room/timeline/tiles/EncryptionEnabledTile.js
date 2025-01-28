/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {SimpleTile} from "./SimpleTile";

export class EncryptionEnabledTile extends SimpleTile {
    get shape() {
        return "announcement";
    }

    get announcement() {
        const senderName =  this._entry.displayName || this._entry.sender;
        return this.i18n`${senderName} has enabled end-to-end encryption`;
    }
}
