/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {HomeServerApi} from "./net/HomeServerApi";
import type {ILogItem} from "../logging/types";

export async function loadProfiles(userIds: string[], hsApi: HomeServerApi, log: ILogItem): Promise<Profile[]> {
    const profiles = await Promise.all(userIds.map(async userId => {
        const response = await hsApi.profile(userId, {log}).response();
        return new Profile(userId, response.displayname as string, response.avatar_url as string);
    }));
    profiles.sort((a, b) => a.name.localeCompare(b.name));
    return profiles;
}

export interface IProfile {
    get userId(): string;
    get displayName(): string | undefined;
    get avatarUrl(): string | undefined;
    get name(): string;
}

export class Profile implements IProfile {
    constructor(
        public readonly userId: string,
        public readonly displayName: string,
        public readonly avatarUrl: string | undefined
    ) {}

    get name() { return this.displayName || this.userId; }
}

export class UserIdProfile implements IProfile {
    constructor(public readonly userId: string) {}
    get displayName() { return undefined; }
    get name() { return this.userId; }
    get avatarUrl() { return undefined; }
}
