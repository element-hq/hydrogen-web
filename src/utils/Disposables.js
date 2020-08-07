/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

function disposeValue(value) {
    if (typeof value === "function") {
        value();
    } else {
        value.dispose();
    }
}

export class Disposables {
    constructor() {
        this._disposables = [];
    }

    track(disposable) {
        this._disposables.push(disposable);
    }

    dispose() {
        if (this._disposables) {
            for (const d of this._disposables) {
                disposeValue(d);
            }
            this._disposables = null;
        }
    }

    disposeTracked(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const idx = this._disposables.indexOf(value);
        if (idx !== -1) {
            const [foundValue] = this._disposables.splice(idx, 1);
            disposeValue(foundValue);
        } else {
            console.warn("disposable not found, did it leak?", value);
        }
        return null;
    }
}
