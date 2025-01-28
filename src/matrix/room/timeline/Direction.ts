/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class Direction {
    constructor(public readonly isForward: boolean) {
    }

    get isBackward(): boolean {
        return !this.isForward;
    }

    asApiString(): string {
        return this.isForward ? "f" : "b";
    }

    reverse(): Direction {
        return this.isForward ? Direction.Backward : Direction.Forward
    }

    static get Forward(): Direction {
        return _forward;
    }

    static get Backward(): Direction {
        return _backward;
    }
}

const _forward = new Direction(true);
const _backward = new Direction(false);
