/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class Deferred<T> {
    public readonly promise: Promise<T>;
    public readonly resolve: (value: T) => void;
    public readonly reject: (err: Error) => void;
    private _value?: T;

    constructor() {
        let resolve;
        let reject;
        this.promise = new Promise<T>((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
        })
        this.resolve = (value: T) => {
            this._value = value;
            resolve(value);
        };
        this.reject = reject;
    }

    get value(): T | undefined {
        return this._value;
    }
}
