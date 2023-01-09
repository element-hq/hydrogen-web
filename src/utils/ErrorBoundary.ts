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

export const ErrorValue = Symbol("ErrorBoundary:Error");

export class ErrorBoundary {
    private _error?: Error;

    constructor(private readonly errorCallback: (Error) => void) {}

    /**
     * Executes callback() and then runs errorCallback() on error.
     * This will never throw but instead return `errorValue` if an error occured.
     */
    try<T>(callback: () => T): T | typeof ErrorValue;
    try<T>(callback: () => Promise<T>): Promise<T | typeof ErrorValue> | typeof ErrorValue {
        try {
            let result: T | Promise<T | typeof ErrorValue> = callback();
            if (result instanceof Promise) {
                result = result.catch(err => {
                    this._error = err;
                    this.errorCallback(err);
                    return ErrorValue;
                });
            }
            return result;
        } catch (err) {
            this._error = err;
            this.errorCallback(err);
            return ErrorValue;
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
            });
            assert(emitted);
            assert.strictEqual(result, ErrorValue);
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
            });
            assert(emitted);
            assert.strictEqual(result, ErrorValue);
        }
    }
}