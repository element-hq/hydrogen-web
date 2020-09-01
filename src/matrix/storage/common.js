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

export const STORE_NAMES = Object.freeze([
    "session",
    "roomState",
    "roomSummary",
    "roomMembers",
    "timelineEvents",
    "timelineFragments",
    "pendingEvents",
    "userIdentities",
    "deviceIdentities",
    "olmSessions",
]);

export const STORE_MAP = Object.freeze(STORE_NAMES.reduce((nameMap, name) => {
    nameMap[name] = name;
    return nameMap;
}, {}));

export class StorageError extends Error {
    constructor(message, cause, value) {
        let fullMessage = message;
        if (cause) {
            fullMessage += ": ";
            if (typeof cause.name === "string") {
                fullMessage += `(name: ${cause.name}) `;
            }
            if (typeof cause.code === "number") {
                fullMessage += `(code: ${cause.code}) `;
            }
        }
        if (value) {
            fullMessage += `(value: ${JSON.stringify(value)}) `;
        }
        if (cause) {
            fullMessage += cause.message;
        }
        super(fullMessage);
        if (cause) {
            this.errcode = cause.name;
        }
        this.cause = cause;
        this.value = value;
    }

    get name() {
        return "StorageError";
    }
}
