/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
    crossSigningKeys = "crossSigningKeys",
    sharedSecrets = "sharedSecrets",
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
