/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ViewModel, Options} from "../../../ViewModel";
import type {SegmentType} from "../../../navigation/index";

export class MissingKeysViewModel extends ViewModel<SegmentType, Options> {
    gotoSettings() {
        this.navigation.push("settings", true);
    }

    get kind(): string {
        return "keys-missing";
    }
}
