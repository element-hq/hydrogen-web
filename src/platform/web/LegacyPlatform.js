/*
Copyright 2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import aesjs from "aes-js";
import {hkdf} from "../../utils/crypto/hkdf";

import {Platform as ModernPlatform} from "./Platform.js";

export function Platform({ container, assetPaths, config, configURL, options = null }) {
    return new ModernPlatform({ container, assetPaths, config, configURL, options, cryptoExtras: { aesjs, hkdf }});
}
