/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {BaseMessageTile} from "./BaseMessageTile.js";
import {stringAsBody} from "../MessageBody.js";
import {createEnum} from "../../../../../utils/enum";

export const BodyFormat = createEnum("Plain", "Html");

export class BaseTextTile extends BaseMessageTile {
    constructor(entry, options) {
        super(entry, options);
        this._messageBody = null;
        this._format = null
    }

    get shape() {
        return "message";
    }

    _parseBody(body) {
        return stringAsBody(body);
    }

    _getBodyFormat() {
        return BodyFormat.Plain;
    }

    get body() {
        const body = this._getBody();
        const format = this._getBodyFormat();
        // body is a string, so we can check for difference by just
        // doing an equality check
        // Even if the body hasn't changed, but the format has, we need
        // to re-fill our cache.
        if (!this._messageBody || this._messageBody.sourceString !== body || this._format !== format) {
            // body with markup is an array of parts,
            // so we should not recreate it for the same body string,
            // or else the equality check in the binding will always fail.
            // So cache it here.
            this._messageBody = this._parseBody(body, format);
            this._format = format;
        }
        return this._messageBody;
    }

}
