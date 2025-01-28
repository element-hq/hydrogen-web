/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageTile} from "./BaseMessageTile.js";

export class MissingAttachmentTile extends BaseMessageTile {
    get shape() {
        return "missing-attachment"
    }

    get label() {
        const name = this._getContent().body;
        const msgtype = this._getContent().msgtype;
        if (msgtype === "m.image") {
            return this.i18n`The image ${name} wasn't fully sent previously and could not be recovered.`;
        } else {
            return this.i18n`The file ${name} wasn't fully sent previously and could not be recovered.`;
        }
    }
}
