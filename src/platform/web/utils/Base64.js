/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import base64 from "base64-arraybuffer";

export class Base64 {
    encodeUnpadded(buffer) {
        const str = base64.encode(buffer);
        const paddingIdx = str.indexOf("=");
        if (paddingIdx !== -1) {
            return str.substr(0, paddingIdx);
        } else {
            return str;
        }
    }

    encode(buffer) {
        return base64.encode(buffer);
    }

    decode(str) {
        return base64.decode(str);
    }
}
