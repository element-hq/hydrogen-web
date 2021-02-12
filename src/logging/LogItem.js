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

import {LogLevel} from "./LogLevel.js";

export class LogItem {
    constructor(labelOrValues, logLevel, platform, anonymize) {
        this._platform = platform;
        this._anonymize = anonymize;
        this._start = platform.clock.now();
        this._end = null;
        this._values = typeof labelOrValues === "string" ? {label: labelOrValues} : labelOrValues;
        this._error = null;
        this._children = [];
        this._logLevel = logLevel;
    }

    /**
     * Creates a new child item and runs it in `callback`.
     */
    wrap(labelOrValues, callback, logLevel = this._logLevel) {
        const item = this.child(labelOrValues, logLevel);
        return item.run(callback);
    }
    
    /**
     * Creates a new child item that finishes immediately
     * and can hence not be modified anymore.
     * 
     * Hence, the child item is not returned.
     */
    log(labelOrValues, logLevel = this._logLevel) {
        const item = this.child(labelOrValues, logLevel);
        item.end = item.start;
    }

    set(key, value) {
        if(typeof key === "object") {
            const values = key;
            Object.assign(this._values, values);
        } else {
            this._values[key] = value;
        }
    }

    anonymize(value) {
        if (this._anonymize) {
            const buffer = this._platform.crypto.digest("SHA-256", this._platform.encoding.utf8.encode(value));
            return this._platform.encoding.base64.encode(buffer);
        } else {
            return value;
        }
    }

    serialize(logLevel) {
        const children = this._children.reduce((array, c) => {
            const s = c.serialize(logLevel);
            if (s) {
                array = array || [];
                array.push(s);
            }
            return array;
        }, null);

        // neither our children or us have a loglevel high enough, bail out.
        if (!children && this._logLevel < logLevel) {
            return null;
        }

        let error = null;
        if (this._error) {
            error = {
                stack: this._error.stack,
                name: this._error.name
            };
        }
        return {
            start: this._start,
            end: this._end,
            values: this._values,
            error,
            children,
            logLevel: this._logLevel
        };
    }

    /**
     * You probably want to use `wrap` instead of this.
     * 
     * Runs a callback passing this log item,
     * recording the timing and any error.
     *
     * callback can return a Promise.
     *
     * Should only be called once.
     * 
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    run(callback) {
        if (this._end !== null) {
            console.trace("log item is finished, additional logs will likely not be recorded");
        }
        let result;
        try {
            result = callback(this);
            if (result instanceof Promise) {
                return result.then(promiseResult => {
                    this.finish();
                    return promiseResult;
                }, err => {
                    throw this.catch(err);
                });
            } else {
                this.finish();
                return result;
            }
        } catch (err) {
            throw this.catch(err);
        }
    }

    /**
     * finished the item, recording the end time. After finishing, an item can't be modified anymore as it will be persisted.
     * @internal shouldn't typically be called by hand. allows to force finish if a promise is still running when closing the app
     */
    finish() {
        if (this._end === null) {
            for(const c of this._children) {
                c.finish();
            }
            this._end = this._platform.clock.now();
        }
    }

    // expose log level without needing 
    get level() {
        return LogLevel;
    }

    catch(err) {
        this._error = err;
        this._logLevel = LogLevel.Error;
        this.finish();
        return err;
    }

    child(labelOrValues, logLevel) {
        if (this._end !== null) {
            console.trace("log item is finished, additional logs will likely not be recorded");
        }
        const item = new LogItem(labelOrValues, logLevel, this._platform, this._anonymize);
        this._children.push(item);
        return item;
    }
}
