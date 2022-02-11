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
