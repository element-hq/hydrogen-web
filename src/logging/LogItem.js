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

import {LogLevel, LogFilter} from "./LogFilter.js";

export class LogItem {
    constructor(labelOrValues, logLevel, filterCreator, logger) {
        this._logger = logger;
        this._start = logger._now();
        this._end = null;
        // (l)abel
        this._values = typeof labelOrValues === "string" ? {l: labelOrValues} : labelOrValues;
        this.error = null;
        this.logLevel = logLevel;
        this._children = null;
        this._filterCreator = filterCreator;
    }

    runDetached(labelOrValues, callback, logLevel, filterCreator) {
        return this._logger.runDetached(labelOrValues, callback, logLevel, filterCreator);
    }

    wrapDetached(labelOrValues, callback, logLevel, filterCreator) {
        this.refDetached(this.runDetached(labelOrValues, callback, logLevel, filterCreator));
    }

    /**
     * Creates a new child item and runs it in `callback`.
     */
    wrap(labelOrValues, callback, logLevel = null, filterCreator = null) {
        const item = this.child(labelOrValues, logLevel, filterCreator);
        return item.run(callback);
    }

    get duration() {
        if (this._end) {
            return this._end - this._start;
        } else {
            return null;
        }
    }

    durationWithoutType(type) {
        return this.duration - this.durationOfType(type);
    }

    durationOfType(type) {
        if (this._values.t === type) {
            return this.duration;
        } else if (this._children) {
            return this._children.reduce((sum, c) => {
                return sum + c.durationOfType(type);
            }, 0);
        } else {
            return 0;
        }
    }
    
    /**
     * Creates a new child item that finishes immediately
     * and can hence not be modified anymore.
     * 
     * Hence, the child item is not returned.
     */
    log(labelOrValues, logLevel = null) {
        const item = this.child(labelOrValues, logLevel, null);
        item._end = item._start;
    }

    refDetached(logItem, logLevel = null) {
        return this.log({ref: logItem._values.refId}, logLevel);
    }

    set(key, value) {
        if(typeof key === "object") {
            const values = key;
            Object.assign(this._values, values);
        } else {
            this._values[key] = value;
        }
    }

    serialize(filter) {
        if (this._filterCreator) {
            try {
                filter = this._filterCreator(new LogFilter(filter), this);
            } catch (err) {
                console.error("Error creating log filter", err);
            }
        }
        let children;
        if (this._children !== null) {
            children = this._children.reduce((array, c) => {
                const s = c.serialize(filter);
                if (s) {
                    if (array === null) {
                        array = [];
                    }
                    array.push(s);
                }
                return array;
            }, null);
        }
        if (filter && !filter.filter(this, children)) {
            return null;
        }
        // in (v)alues, (l)abel and (t)ype are also reserved.
        const item = {
            // (s)tart
            s: this._start,
            // (d)uration
            d: this.duration,
            // (v)alues
            v: this._values,
            // (l)evel
            l: this.logLevel
        };
        if (this.error) {
            // (e)rror
            item.e = {
                stack: this.error.stack,
                name: this.error.name
            };
        }
        if (children) {
            // (c)hildren
            item.c = children;
        }
        return item;
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
            if (this._children !== null) {
                for(const c of this._children) {
                    c.finish();
                }
            }
            this._end = this._logger._now();
        }
    }

    // expose log level without needing import everywhere
    get level() {
        return LogLevel;
    }

    catch(err) {
        this.error = err;
        this.logLevel = LogLevel.Error;
        this.finish();
        return err;
    }

    child(labelOrValues, logLevel, filterCreator) {
        if (this._end !== null) {
            console.trace("log item is finished, additional logs will likely not be recorded");
        }
        if (!logLevel) {
            logLevel = this.logLevel || LogLevel.Info;
        }
        const item = new LogItem(labelOrValues, logLevel, filterCreator, this._logger);
        if (this._children === null) {
            this._children = [];
        }
        this._children.push(item);
        return item;
    }
}
