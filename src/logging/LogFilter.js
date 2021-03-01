/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

export const LogLevel = {
    All: 1,
    Debug: 2,
    Detail: 3,
    Info: 4,
    Warn: 5,
    Error: 6,
    Fatal: 7,
    Off: 8,
}

export class LogFilter {
    constructor(parentFilter) {
        this._parentFilter = parentFilter;
        this._min = null;
    }

    filter(item, children) {
        if (this._parentFilter) {
            if (!this._parentFilter.filter(item, children)) {
                return false;
            }
        }
        // neither our children or us have a loglevel high enough, filter out.
        if (this._min !== null && !Array.isArray(children) && item.logLevel < this._min) {
            return false;
        } else {
            return true;
        }
    }

    /* methods to build the filter */
    minLevel(logLevel) {
        this._min = logLevel;
        return this;
    }
}
