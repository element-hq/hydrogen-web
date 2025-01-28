/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import bs58 from "bs58";

export class Base58 {
    encode(buffer) {
        return bs58.encode(buffer);
    }

    decode(str) {
        return bs58.decode(str);
    }
}
