/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
export class UTF8 {
    constructor() {
        this._encoder = null;
        this._decoder = null;
    }

    encode(str) {
        if (!this._encoder) {
            this._encoder = new TextEncoder();
        }
        return this._encoder.encode(str);
    }

    decode(buffer) {
        if (!this._decoder) {
            this._decoder = new TextDecoder();
        }
        return this._decoder.decode(buffer);
    }
}
