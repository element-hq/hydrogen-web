/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ObservableValue} from "./index";

export class RetainedObservableValue<T> extends ObservableValue<T> {

    constructor(initialValue: T, private freeCallback: () => void, private startCallback: () => void = () => {}) {
        super(initialValue);
    }

    onSubscribeFirst(): void {
        this.startCallback();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        this.freeCallback();
    }
}
