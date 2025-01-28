/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class RetainedValue {
    private readonly _freeCallback: () => void;
    private _retentionCount: number = 1;

    constructor(freeCallback: () => void) {
        this._freeCallback = freeCallback;
    }

    retain(): void {
        this._retentionCount += 1;
    }

    release(): void {
        this._retentionCount -= 1;
        if (this._retentionCount === 0) {
            this._freeCallback();
        }
    }
}
