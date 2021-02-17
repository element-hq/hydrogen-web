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

import {LogItem} from "./LogItem.js";
import {LogLevel, LogFilter} from "./LogFilter.js";

export class BaseLogger {
    constructor({platform}) {
        this._openItems = new Set();
        this._platform = platform;
    }

    run(labelOrValues, callback, logLevel = LogLevel.Info, filterCreator = null) {
        const item = new LogItem(labelOrValues, logLevel, null, this._platform.clock);
        this._openItems.add(item);

        const finishItem = () => {
            let filter = new LogFilter();
            if (filterCreator) {
                try {
                    filter = filterCreator(filter, this);
                } catch (err) {
                    console.error("Error while creating log filter", err);
                }
            } else {
                // if not filter is specified, filter out anything lower than the initial log level
                filter = filter.minLevel(logLevel);
            }
            try {
                const serialized = item.serialize(filter);
                if (serialized) {
                    this._persistItem(serialized);
                }
            } catch (err) {
                console.error("Could not serialize log item", err);
            }
            this._openItems.delete(item);
        };

        try {
            const result = item.run(callback);
            if (result instanceof Promise) {
                return result.then(promiseResult => {
                    finishItem();
                    return promiseResult;
                }, err => {
                    finishItem();
                    throw err;
                });
            } else {
                finishItem();
                return result;
            }
        } catch (err) {
            finishItem();
            throw err;
        }
    }

    _finishOpenItems() {
        for (const openItem of this._openItems) {
            openItem.finish();
            try {
                // for now, serialize with an all-permitting filter
                // as the createFilter function would get a distorted image anyway
                // about the duration of the item, etc ...
                const serialized = openItem.serialize(new LogFilter(), 0);
                if (serialized) {
                    this._persistItem(serialized);
                }
            } catch (err) {
                console.error("Could not serialize log item", err);
            }
        }
        this._openItems.clear();
    }

    _persistItem() {
        throw new Error("not implemented");
    }

    async export() {
        throw new Error("not implemented");
    }

    // expose log level without needing 
    get level() {
        return LogLevel;
    }
}
