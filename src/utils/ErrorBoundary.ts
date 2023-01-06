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

import {ObservableValue, BaseObservableValue} from "../observable/ObservableValue";

export class ErrorBoundary {
    constructor(private readonly errorCallback: (Error) => void) {}

    try<T>(callback: () => T): T | undefined;
    try<T>(callback: () => Promise<T>): Promise<T | undefined> | undefined {
        try {
            let result: T | Promise<T | undefined> = callback();
            if (result instanceof Promise) {
                result = result.catch(err => {
                    this.errorCallback(err);
                    return undefined;
                });
            }
            return result;
        } catch (err) {
            this.errorCallback(err);
            return undefined;
        }
    }
}
