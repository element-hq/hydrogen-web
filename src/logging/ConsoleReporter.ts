/*
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

import type {ILogger, ILogItem, LogItemValues, ILogReporter} from "./types";
import type {LogItem} from "./LogItem";

export class ConsoleReporter implements ILogReporter {
    private logger?: ILogger;

    reportItem(item: ILogItem): void {
        printToConsole(item as LogItem);
    }

    setLogger(logger: ILogger) {
        this.logger = logger;
    }

    printOpenItems(): void {
        if (!this.logger) {
            return;
        }
        for (const item of this.logger.getOpenRootItems()) {
            this.reportItem(item);
        }
    }
}

const excludedKeysFromTable = ["l", "id"];
function filterValues(values: LogItemValues): LogItemValues | null {
    return Object.entries(values)
        .filter(([key]) => !excludedKeysFromTable.includes(key))
        .reduce((obj: LogItemValues, [key, value]) => {
            obj = obj || {};
            obj[key] = value;
            return obj;
        }, null);
}

function hasChildWithError(item: LogItem): boolean {
    if (item.error) {
        return true;
    }
    if (item.children) {
        for(const c of item.children) {
            if (hasChildWithError(c)) {
                return true;
            }
        }
    }
    return false;
}

function printToConsole(item: LogItem): void {
    const label = `${itemCaption(item)} (@${item.start}ms, duration: ${item.duration}ms)`;
    const filteredValues = filterValues(item.values);
    const shouldGroup = item.children || filteredValues;
    if (shouldGroup) {
        if (hasChildWithError(item)) {
            console.group(label);
        } else {
            console.groupCollapsed(label);
        }
        if (item.error) {
            console.error(item.error);
        }
    } else {
        if (item.error) {
            console.error(item.error);
        } else {
            console.log(label);
        }
    }
    if (filteredValues) {
        console.table(filteredValues);
    }
    if (item.children) {
        for(const c of item.children) {
            printToConsole(c);
        }
    }
    if (shouldGroup) {
        console.groupEnd();
    }
}

function itemCaption(item: ILogItem): string {
    if (item.values.t === "network") {
        return `${item.values.method} ${item.values.url}`;
    } else if (item.values.l && typeof item.values.id !== "undefined") {
        return `${item.values.l} ${item.values.id}`;
    } else if (item.values.l && typeof item.values.status !== "undefined") {
        return `${item.values.l} (${item.values.status})`;
    } else if (item.values.l && typeof item.values.type !== "undefined") {
        return `${item.values.l} (${item.values.type})`;
    } else if (item.values.l && item.error) {
        return `${item.values.l} failed`;
    } else if (typeof item.values.ref !== "undefined") {
        return `ref ${item.values.ref}`;
    } else {
        return item.values.l || item.values.type;
    }
}
