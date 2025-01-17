/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {UTF8} from "../dom/UTF8.js";
import {Base64} from "./Base64.js";
import {Base58} from "./Base58.js";

export class Encoding {
    constructor() {
        this.utf8 = new UTF8();
        this.base64 = new Base64();
        this.base58 = new Base58();
    }
}
