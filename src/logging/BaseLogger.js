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
import {LogLevel} from "./LogLevel.js";

export class BaseLogger {
    constructor({platform, baseLogLevel, anonymize}) {
        this._openItems = new Set();
        this._platform = platform;
        this._anonymize = anonymize;
        this._baseLogLevel = baseLogLevel;
    }

    wrapLog(labelOrValues, callback, logLevel = this._baseLogLevel) {
        const item = new LogItem(labelOrValues, logLevel, this._platform, this._anonymize);
        this._openItems.add(item);

        const finishItem = () => {
            const serialized = item.serialize(this._baseLogLevel);
            if (serialized) {
                this._persistItem(serialized);
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
            const serialized = openItem.serialize(this._baseLogLevel);
            if (serialized) {
                this._persistItem(serialized);
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
