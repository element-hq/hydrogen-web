/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
