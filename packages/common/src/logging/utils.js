// these are helper functions if you can't assume you always have a log item (e.g. some code paths call with one set, others don't)
// if you know you always have a log item, better to use the methods on the log item than these utility functions.

import {Instance as NullLoggerInstance} from "./NullLogger.js";

export function wrapOrRunNullLogger(logItem, labelOrValues, callback, logLevel = null, filterCreator = null) {
    if (logItem) {
        return logItem.wrap(logItem, labelOrValues, callback, logLevel, filterCreator);
    } else {
        return NullLoggerInstance.run(null, callback);
    }
}

export function ensureLogItem(logItem) {
    return logItem || NullLoggerInstance.item;
}
