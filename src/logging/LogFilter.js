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

export const LogLevel = {
    All: 1,
    Debug: 2,
    Info: 3,
    Warn: 4,
    Error: 5,
    Fatal: 6,
    Off: 7,
}

export class LogFilter {
    constructor(parentFilter) {
        this._parentFilter = parentFilter;
        this._min = null;
        this._maxDepth = null;
    }

    filter(item, children, depth) {
        if (this._parentFilter) {
            if (!this._parentFilter.filter(item, children, depth)) {
                return false;
            }
        }
        // neither our children or us have a loglevel high enough, filter out.
        if (this._min !== null && children === null && item.logLevel < this._min) {
            return false;
        } if (this._maxDepth !== null && depth > this._maxDepth) {
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

    maxDepth(depth) {
        this._maxDepth = depth;
        return this;
    }
}
