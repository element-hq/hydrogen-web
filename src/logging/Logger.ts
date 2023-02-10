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

import {LogItem} from "./LogItem";
import {LogLevel, LogFilter} from "./LogFilter";
import type {ILogger, ILogReporter, FilterCreator, LabelOrValues, LogCallback, ILogItem, ISerializedItem} from "./types";
import type {Platform} from "../platform/web/Platform.js";

export class Logger implements ILogger {
    protected _openItems: Set<LogItem> = new Set();
    protected _platform: Platform;
    protected _serializedTransformer: (item: ISerializedItem) => ISerializedItem;
    public readonly reporters: ILogReporter[] = [];

    constructor({platform}) {
        this._platform = platform;
    }

    log(labelOrValues: LabelOrValues, logLevel: LogLevel = LogLevel.Info): ILogItem {
        const item = new LogItem(labelOrValues, logLevel, this);
        item.end = item.start;
        this._persistItem(item, undefined, false);
        return item;
    }

    /** Prefer `run()` or `log()` above this method; only use it if you have a long-running operation
     *  *without* a single call stack that should be logged into one sub-tree.
     *  You need to call `finish()` on the returned item or it will stay open until the app unloads. */
    child(labelOrValues: LabelOrValues, logLevel: LogLevel = LogLevel.Info, filterCreator?: FilterCreator): ILogItem {
        const item = new DeferredPersistRootLogItem(labelOrValues, logLevel, this, filterCreator);
        this._openItems.add(item);
        return item;
    }

    /** if item is a log item, wrap the callback in a child of it, otherwise start a new root log item. */
    wrapOrRun<T>(item: ILogItem | undefined, labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T {
        if (item) {
            return item.wrap(labelOrValues, callback, logLevel, filterCreator);
        } else {
            return this.run(labelOrValues, callback, logLevel, filterCreator);
        }
    }

    /** run a callback in detached mode,
    where the (async) result or errors are not propagated but still logged.
    Useful to pair with LogItem.refDetached.

    @return {ILogItem} the log item added, useful to pass to LogItem.refDetached */
    runDetached<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): ILogItem {
        if (!logLevel) {
            logLevel = LogLevel.Info;
        }
        const item = new LogItem(labelOrValues, logLevel, this);
        this._run(item, callback, logLevel, false /* don't throw, nobody is awaiting */, filterCreator);
        return item;
    }

    /** run a callback wrapped in a log operation.
    Errors and duration are transparently logged, also for async operations.
    Whatever the callback returns is returned here. */
    run<T>(labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T {
        if (logLevel === undefined) {
            logLevel = LogLevel.Info;
        }
        const item = new LogItem(labelOrValues, logLevel, this);
        return this._run(item, callback, logLevel, true, filterCreator);
    }

    private _run<T>(item: LogItem, callback: LogCallback<T>, logLevel: LogLevel, wantResult: true, filterCreator?: FilterCreator): T;
    // we don't return if we don't throw, as we don't have anything to return when an error is caught but swallowed for the fire-and-forget case.
    private _run<T>(item: LogItem, callback: LogCallback<T>, logLevel: LogLevel, wantResult: false, filterCreator?: FilterCreator): void;
    private _run<T>(item: LogItem, callback: LogCallback<T>, logLevel: LogLevel, wantResult: boolean, filterCreator?: FilterCreator): T | void {
        this._openItems.add(item);

        const finishItem = () => {
            let filter = new LogFilter();
            if (filterCreator) {
                try {
                    filter = filterCreator(filter, item);
                } catch (err) {
                    console.error("Error while creating log filter", err);
                }
            } else {
                // if not filter is specified, filter out anything lower than the initial log level
                filter = filter.minLevel(logLevel);
            }
            try {
                this._persistItem(item, filter, false);
            } catch (err) {
                console.error("Could not persist log item", err);
            }
            this._openItems.delete(item);
        };

        try {
            let result = item.run(callback);
            if (result instanceof Promise) {
                result =  result.then(promiseResult => {
                    finishItem();
                    return promiseResult;
                }, err => {
                    finishItem();
                    if (wantResult) {
                        throw err;
                    }
                }) as unknown as T;
                if (wantResult) {
                    return result;
                }
            } else {
                finishItem();
                if(wantResult) {
                    return result;
                }
            }
        } catch (err) {
            finishItem();
            if (wantResult) {
                throw err;
            }
        }
    }

    addReporter(reporter: ILogReporter): void {
        reporter.setLogger(this);
        this.reporters.push(reporter);
    }

    getOpenRootItems(): Iterable<ILogItem> {
        return this._openItems;
    }

    forceFinish() {
        for (const openItem of this._openItems) {
            openItem.forceFinish();
            try {
                // for now, serialize with an all-permitting filter
                // as the createFilter function would get a distorted image anyway
                // about the duration of the item, etc ...
                // true for force finish
                this._persistItem(openItem, new LogFilter(), true);
            } catch (err) {
                console.error("Could not serialize log item", err);
            }
        }
        this._openItems.clear();
    }

    /** @internal */
    _removeItemFromOpenList(item: LogItem): void {
        this._openItems.delete(item);
    }

    /** @internal */
    _persistItem(item: LogItem, filter?: LogFilter, forced?: boolean): void {
        for (var i = 0; i < this.reporters.length; i += 1) {
            this.reporters[i].reportItem(item, filter, forced);
        }
    }

    // expose log level without needing 
    get level(): typeof LogLevel {
        return LogLevel;
    }

    /** @internal */
    _now(): number {
        return this._platform.clock.now();
    }

    /** @internal */
    _createRefId(): number {
        return Math.round(this._platform.random() * Number.MAX_SAFE_INTEGER);
    }
}

class DeferredPersistRootLogItem extends LogItem {
    finish() {
        super.finish();
        (this._logger as Logger)._persistItem(this, undefined, false);
        (this._logger as Logger)._removeItemFromOpenList(this);
    }

    forceFinish() {
        super.finish();
        /// no need to persist when force-finishing as _finishOpenItems above will do it
    }
}
