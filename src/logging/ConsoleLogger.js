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
import {BaseLogger} from "./BaseLogger.js";

export class ConsoleLogger extends BaseLogger {
    _persistItem(item) {
        printToConsole(item);
    }
}

const excludedKeysFromTable = ["l", "id"];
function filterValues(values) {
    if (!values) {
        return null;
    }
    return Object.entries(values)
        .filter(([key]) => !excludedKeysFromTable.includes(key))
        .reduce((obj, [key, value]) => {
            obj = obj || {};
            obj[key] = value;
            return obj;
        }, null);
}

function printToConsole(item) {
    const label = `${itemCaption(item)} (${item.duration}ms)`;
    const filteredValues = filterValues(item._values);
    const shouldGroup = item._children || filteredValues;
    if (shouldGroup) {
        if (item.error) {
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
    if (item._children) {
        for(const c of item._children) {
            printToConsole(c);
        }
    }
    if (shouldGroup) {
        console.groupEnd();
    }
}

function itemCaption(item) {
    if (item._values.t === "network") {
        return `${item._values.method} ${item._values.url}`;
    } else if (item._values.l && typeof item._values.id !== "undefined") {
        return `${item._values.l} ${item._values.id}`;
    } else if (item._values.l && typeof item._values.status !== "undefined") {
        return `${item._values.l} (${item._values.status})`;
    } else if (item._values.l && item.error) {
        return `${item._values.l} failed`;
    } else if (typeof item._values.ref !== "undefined") {
        return `ref ${item._values.ref}`;
    } else {
        return item._values.l || item._values.type;
    }
}
