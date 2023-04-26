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

export enum StoreNames {
    session = "session",
    roomState = "roomState",
    roomSummary = "roomSummary",
    archivedRoomSummary = "archivedRoomSummary",
    invites = "invites",
    roomMembers = "roomMembers",
    timelineEvents = "timelineEvents",
    timelineRelations = "timelineRelations",
    timelineFragments = "timelineFragments",
    pendingEvents = "pendingEvents",
    userIdentities = "userIdentities",
    deviceKeys = "deviceKeys",
    olmSessions = "olmSessions",
    inboundGroupSessions = "inboundGroupSessions",
    outboundGroupSessions = "outboundGroupSessions",
    groupSessionDecryptions = "groupSessionDecryptions",
    operations = "operations",
    accountData = "accountData",
    calls = "calls",
    crossSigningKeys = "crossSigningKeys"
}

export const STORE_NAMES: Readonly<StoreNames[]> = Object.values(StoreNames);

export class StorageError extends Error {
    errcode?: string;
    cause: Error | null;

    constructor(message: string, cause: Error | null = null) {
        super(message);
        if (cause) {
            this.errcode = cause.name;
        }
        this.cause = cause;
    }

    get name(): string {
        return "StorageError";
    }
}

export const KeyLimits = {
    get minStorageKey(): number {
        // for indexeddb, we use unsigned 32 bit integers as keys
        return 0;
    },
    
    get middleStorageKey(): number {
        // for indexeddb, we use unsigned 32 bit integers as keys
        return 0x7FFFFFFF;
    },

    get maxStorageKey(): number {
        // for indexeddb, we use unsigned 32 bit integers as keys
        return 0xFFFFFFFF;
    }
}
