/*
Copyright 2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class ErrorBoundary {
    private _error?: Error;

    constructor(private readonly errorCallback: (err: Error) => void) {}

    /**
     * Executes callback() and then runs errorCallback() on error.
     * This will never throw but instead return `errorValue` if an error occurred.
     */
    try<T, E>(callback: () => T, errorValue?: E): T | typeof errorValue;
    try<T, E>(callback: () => Promise<T>, errorValue?: E): Promise<T | typeof errorValue> | typeof errorValue {
        try {
            let result: T | Promise<T | typeof errorValue> = callback();
            if (result instanceof Promise) {
                result = result.catch(err => {
                    this._error = err;
                    this.reportError(err);
                    return errorValue;
                });
            }
            return result;
        } catch (err) {
            this._error = err;
            this.reportError(err);
            return errorValue;
        }
    }

    reportError(err: Error) {
        try {
            this.errorCallback(err);
        } catch (err) {
            console.error("error in ErrorBoundary callback", err);
        }
    }

    get error(): Error | undefined {
        return this._error;
    }
}

export function tests() {
    return {
        "catches sync error": assert => {
            let emitted = false;
            const boundary = new ErrorBoundary(() => emitted = true);
            const result = boundary.try(() => {
                throw new Error("fail!");
            }, 0);
            assert(emitted);
            assert.strictEqual(result, 0);
        },
        "return value of callback is forwarded": assert => {
            let emitted = false;
            const boundary = new ErrorBoundary(() => emitted = true);
            const result = boundary.try(() => {
                return "hello";
            });
            assert(!emitted);
            assert.strictEqual(result, "hello");
        },
        "catches async error": async assert => {
            let emitted = false;
            const boundary = new ErrorBoundary(() => emitted = true);
            const result = await boundary.try(async () => {
                throw new Error("fail!");
            }, 0);
            assert(emitted);
            assert.strictEqual(result, 0);
        },
        "exception in error callback is swallowed": async assert => {
            let emitted = false;
            const boundary = new ErrorBoundary(() => { throw new Error("bug in errorCallback"); });
            assert.doesNotThrow(() => {
                boundary.try(() => {
                    throw new Error("fail!");
                });
            });
        }
    }
}
