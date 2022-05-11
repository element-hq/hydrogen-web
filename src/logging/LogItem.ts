/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
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

import {LogLevel, LogFilter} from "./LogFilter";
import type {Logger} from "./Logger";
import type {ISerializedItem, ILogItem, LogItemValues, LabelOrValues, FilterCreator, LogCallback} from "./types";

export class LogItem implements ILogItem {
    public readonly start: number;
    public logLevel: LogLevel;
    public error?: Error;
    public end?: number;
    private _values: LogItemValues;
    protected _logger: Logger;
    private _filterCreator?: FilterCreator;
    private _children?: Array<LogItem>;

    constructor(labelOrValues: LabelOrValues, logLevel: LogLevel, logger: Logger, filterCreator?: FilterCreator) {
        this._logger = logger;
        this.start = logger._now();
        // (l)abel
        this._values = typeof labelOrValues === "string" ? {l: labelOrValues} : labelOrValues;
        this.logLevel = logLevel;
        this._filterCreator = filterCreator;
    }

    /** start a new root log item and run it detached mode, see Logger.runDetached */
    runDetached(labelOrValues: LabelOrValues, callback: LogCallback<unknown>, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem {
        return this._logger.runDetached(labelOrValues, callback, logLevel, filterCreator);
    }

    /** start a new detached root log item and log a reference to it from this item */
    wrapDetached(labelOrValues: LabelOrValues, callback: LogCallback<unknown>, logLevel?: LogLevel, filterCreator?: FilterCreator): void {
        this.refDetached(this.runDetached(labelOrValues, callback, logLevel, filterCreator));
    }

    /** logs a reference to a different log item, usually obtained from runDetached.
    This is useful if the referenced operation can't be awaited. */
    refDetached(logItem: ILogItem, logLevel?: LogLevel): void {
        logItem.ensureRefId();
        this.log({ref: logItem.values.refId}, logLevel);
    }

    ensureRefId(): void {
        if (!this._values.refId) {
            this.set("refId", this._logger._createRefId());
        }
    }

    /**
     * Creates a new child item and runs it in `callback`.
     */
    wrap<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T {
        const item = this.child(labelOrValues, logLevel, filterCreator);
        return item.run(callback);
    }

    get duration(): number | undefined {
        if (this.end) {
            return this.end - this.start;
        } else {
            return undefined;
        }
    }

    durationWithoutType(type: string): number | undefined {
        const durationOfType = this.durationOfType(type);
        if (this.duration && durationOfType) {
            return this.duration - durationOfType;
        }
    }

    durationOfType(type: string): number | undefined {
        if (this._values.t === type) {
            return this.duration;
        } else if (this._children) {
            return this._children.reduce((sum, c) => {
                const duration = c.durationOfType(type);
                return sum + (duration ?? 0);
            }, 0);
        } else {
            return 0;
        }
    }
    
    /**
     * Creates a new child item that finishes immediately
     * Finished items should not be modified anymore as they can be serialized
     * at any stage, but using `set` on the return value in a synchronous way should still be safe.
     */
    log(labelOrValues: LabelOrValues, logLevel?: LogLevel): ILogItem {
        const item = this.child(labelOrValues, logLevel);
        item.end = item.start;
        return item;
    }

    set(key: string | object, value?: unknown): ILogItem {
        if(typeof key === "object") {
            const values = key;
            Object.assign(this._values, values);
        } else {
            this._values[key] = value;
        }
        return this;
    }

    serialize(filter: LogFilter, parentStartTime: number | undefined, forced: boolean): ISerializedItem | undefined {
        if (this._filterCreator) {
            try {
                filter = this._filterCreator(new LogFilter(filter), this);
            } catch (err) {
                console.error("Error creating log filter", err);
            }
        }
        let children: Array<ISerializedItem> | null = null;
        if (this._children) {
            children = this._children.reduce((array: Array<ISerializedItem>, c) => {
                const s = c.serialize(filter, this.start, false);
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
            return;
        }
        // in (v)alues, (l)abel and (t)ype are also reserved.
        const item: ISerializedItem = {
            // (s)tart
            s: typeof parentStartTime === "number" ? this.start - parentStartTime : this.start,
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
                name: this.error.name,
                message: this.error.message.split("\n")[0]
            };
        }
        if (forced) {
            item.f = true;    //(f)orced
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
    run<T>(callback: LogCallback<T>): T {
        if (this.end !== undefined) {
            console.trace("log item is finished, additional logs will likely not be recorded");
        }
        try {
            const result = callback(this);
            if (result instanceof Promise) {
                return result.then(promiseResult => {
                    this.finish();
                    return promiseResult;
                }, err => {
                    throw this.catch(err);
                }) as unknown as T;
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
    finish(): void {
        if (this.end === undefined) {
            if (this._children) {
                for(const c of this._children) {
                    c.finish();
                }
            }
            this.end = this._logger._now();
        }
    }

    /** @internal */
    forceFinish(): void {
        this.finish();
    }

    // expose log level without needing import everywhere
    get level(): typeof LogLevel {
        return LogLevel;
    }

    catch(err: Error): Error {
        this.error = err;
        this.logLevel = LogLevel.Error;
        this.finish();
        return err;
    }

    child(labelOrValues: LabelOrValues, logLevel?: LogLevel, filterCreator?: FilterCreator): LogItem {
        if (this.end) {
            console.trace(`log item ${this.values.l} finished, additional log ${JSON.stringify(labelOrValues)} will likely not be recorded`);
        }
        if (!logLevel) {
            logLevel = this.logLevel || LogLevel.Info;
        }
        const item = new LogItem(labelOrValues, logLevel, this._logger, filterCreator);
        if (!this._children) {
            this._children = [];
        }
        this._children.push(item);
        return item;
    }

    get logger(): Logger {
        return this._logger;
    }

    get values(): LogItemValues {
        return this._values;
    }

    get children(): Array<LogItem> | undefined {
        return this._children;
    }
}
