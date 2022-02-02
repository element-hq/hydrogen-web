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

import {calculateRoomName} from "./members/Heroes";
import {createRoomEncryptionEvent} from "../e2ee/common";
import {EventEmitter} from "../../utils/EventEmitter";

import type {StateEvent} from "../storage/types";
import type {HomeServerApi} from "../net/HomeServerApi";
import type {ILogItem} from "../../logging/types";

type CreateRoomPayload = {
    is_direct?: boolean;
    preset?: string;
    name?: string;
    topic?: string;
    invite?: string[];
    initial_state?: StateEvent[]
}

export enum RoomType {
    DirectMessage,
    Private,
    Public
}

function defaultE2EEStatusForType(type: RoomType): boolean {
    switch (type) {
        case RoomType.DirectMessage:
        case RoomType.Private:
            return true;
        case RoomType.Public:
            return false;
    }
}

function presetForType(type: RoomType): string {
    switch (type) {
        case RoomType.DirectMessage:
            return "trusted_private_chat";
        case RoomType.Private:
            return "private_chat";
        case RoomType.Public:
            return "public_chat";
    }
}

export class RoomBeingCreated extends EventEmitter<{change: never, joined: string}> {
    private _roomId?: string;
    private profiles: Profile[] = [];

    public readonly isEncrypted: boolean;
    public readonly name: string;

    constructor(
        private readonly localId: string,
        private readonly type: RoomType,
        isEncrypted: boolean | undefined,
        private readonly explicitName: string | undefined,
        private readonly topic: string | undefined,
        private readonly inviteUserIds: string[] | undefined,
        log: ILogItem
    ) {
        super();
        this.isEncrypted = isEncrypted === undefined ? defaultE2EEStatusForType(this.type) : isEncrypted;
        if (explicitName) {
            this.name = explicitName;
        } else {
            const summaryData = {
                joinCount: 1, // ourselves
                inviteCount: (this.inviteUserIds?.length || 0)
            };
            this.name = calculateRoomName(this.profiles, summaryData, log);
        }
    }

    public async start(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        await Promise.all([
            this.loadProfiles(hsApi, log),
            this.create(hsApi, log),
        ]);
    }

    private async create(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        const options: CreateRoomPayload = {
            is_direct: this.type === RoomType.DirectMessage,
            preset: presetForType(this.type)
        };
        if (this.explicitName) {
            options.name = this.explicitName;
        }
        if (this.topic) {
            options.topic = this.topic;
        }
        if (this.inviteUserIds) {
            options.invite = this.inviteUserIds;
        }
        if (this.isEncrypted) {
            options.initial_state = [createRoomEncryptionEvent()];
        }

        const response = await hsApi.createRoom(options, {log}).response();
        this._roomId = response["room_id"];
        this.emit("change");
    }

    private async loadProfiles(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        // only load profiles if we need it for the room name and avatar
        if (!this.explicitName && this.inviteUserIds) {
            this.profiles = await loadProfiles(this.inviteUserIds, hsApi, log);
            this.emit("change");
        }
    }

    notifyJoinedRoom() {
        this.emit("joined", this._roomId);
    }

    get avatarUrl(): string | undefined {
        return this.profiles[0]?.avatarUrl;
    }

    get roomId(): string | undefined {
        return this._roomId;
    }
}

export async function loadProfiles(userIds: string[], hsApi: HomeServerApi, log: ILogItem): Promise<Profile[]> {
    const profiles = await Promise.all(userIds.map(async userId => {
        const response = await hsApi.profile(userId, {log}).response();
        return new Profile(userId, response.displayname as string, response.avatar_url as string);
    }));
    profiles.sort((a, b) => a.name.localeCompare(b.name));
    return profiles;
}

interface IProfile {
    get userId(): string;
    get displayName(): string;
    get avatarUrl(): string;
    get name(): string;
}

export class Profile implements IProfile {
    constructor(
        public readonly userId: string,
        public readonly displayName: string,
        public readonly avatarUrl: string
    ) {}

    get name() { return this.displayName || this.userId; }
}
