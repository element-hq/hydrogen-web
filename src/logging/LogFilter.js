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

export function wrapLogFilterSource(logFilterDef) {
    if (typeof logFilterDef === "function") {
        return new DeferredFilterCreator(logFilterDef);
    } else if (typeof logFilterDef === "number") {
        return new SimpleFilterCreator(logFilterDef);
    }
    return null;
}

class LogFilter {
    constructor(parentFilter) {
        this._default = parentFilter ? parentFilter._default : null;
        this._min = parentFilter ? parentFilter._min : null;
    }

    /* methods to build the filter */
    min(logLevel) {
        this._min = logLevel;
        if (this._default === null) {
            this._default = logLevel;
        }
        return this;
    }

    default(logLevel) {
        this._default = logLevel;
        if (this._min === null) {
            this._min = logLevel;
        }
        return this;
    }

    /* methods to use the filter */
    /** determine log level for item */
    itemLevel(item) {
        if (item._error) {
            return LogLevel.Error;
        }
        return this._default;
    }

    /** determines whether an item should be persisted */
    includeItem(item, logLevel, children) {
        // neither our children or us have a loglevel high enough, bail out.
        return logLevel >= this._min || children;
    }
}

/**
 * Allows to determine the log level of an item after it has finished.
 * So we can set the log level on the item duration for example.
 */
class DeferredFilterCreator {
    constructor(fn) {
        this._fn = fn;
    }

    createFilter(item, parentFilter) {
        return this._fn(new LogFilter(parentFilter), item);
    }
}

class SimpleFilterCreator {
    constructor(logLevel) {
        this._logLevel = logLevel;
    }

    createFilter(item, parentFilter) {
        return new LogFilter(parentFilter).default(this._logLevel);
    }
}
