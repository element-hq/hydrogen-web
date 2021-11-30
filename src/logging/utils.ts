// these are helper functions if you can't assume you always have a log item (e.g. some code paths call with one set, others don't)
// if you know you always have a log item, better to use the methods on the log item than these utility functions.

import {Instance as NullLoggerInstance} from "./NullLogger";
import type {FilterCreator, ILogItem, LabelOrValues, LogCallback} from "./types";
import {LogLevel} from "./LogFilter";

export function wrapOrRunNullLogger<T>(logItem: ILogItem | undefined, labelOrValues: LabelOrValues, callback: LogCallback<T>, logLevel?: LogLevel, filterCreator?: FilterCreator): T | Promise<T> {
    if (logItem) {
        return logItem.wrap(labelOrValues, callback, logLevel, filterCreator);
    } else {
        return NullLoggerInstance.run(null, callback);
    }
}

export function ensureLogItem(logItem: ILogItem): ILogItem {
    return logItem || NullLoggerInstance.item;
}
