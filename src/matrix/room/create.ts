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
import {MediaRepository} from "../net/MediaRepository";
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

export class RoomBeingCreated extends EventEmitter<{change: never}> {
    private _roomId?: string;
    private profiles: Profile[] = [];

    public readonly isEncrypted: boolean;
    private _name: string;
    private _error?: Error;

    constructor(
        public readonly localId: string,
        private readonly type: RoomType,
        isEncrypted: boolean | undefined,
        private readonly explicitName: string | undefined,
        private readonly topic: string | undefined,
        private readonly inviteUserIds: string[] | undefined,
        private readonly updateCallback: (self: RoomBeingCreated, params: string | undefined) => void,
        public readonly mediaRepository: MediaRepository,
        log: ILogItem
    ) {
        super();
        this.isEncrypted = isEncrypted === undefined ? defaultE2EEStatusForType(this.type) : isEncrypted;
        if (explicitName) {
            this._name = explicitName;
        } else {
            const summaryData = {
                joinCount: 1, // ourselves
                inviteCount: (this.inviteUserIds?.length || 0)
            };
            const userIdProfiles = (inviteUserIds || []).map(userId => new UserIdProfile(userId));
            this._name = calculateRoomName(userIdProfiles, summaryData, log);
        }
    }

    /** @internal */
    async create(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
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
        try {
            const response = await hsApi.createRoom(options, {log}).response();
            this._roomId = response["room_id"];
        } catch (err) {
            this._error = err;
        }
        this.emitChange();
    }

    /** requests the profiles of the invitees if needed to give an accurate
     * estimated room name in case an explicit room name is not set.
     * The room is being created in the background whether this is called
     * or not, and this just gives a more accurate name while that request
     * is running. */
    /** @internal */
    async loadProfiles(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        // only load profiles if we need it for the room name and avatar
        if (!this.explicitName && this.inviteUserIds) {
            this.profiles = await loadProfiles(this.inviteUserIds, hsApi, log);
            const summaryData = {
                joinCount: 1, // ourselves
                inviteCount: this.inviteUserIds.length
            };
            this._name = calculateRoomName(this.profiles, summaryData, log);
            this.emitChange();
        }
    }

    private emitChange(params?: string) {
        this.updateCallback(this, params);
        this.emit("change");
    }

    get avatarColorId(): string { return this.inviteUserIds?.[0] ?? this._roomId ?? this.localId; }
    get avatarUrl(): string | undefined { return this.profiles[0]?.avatarUrl; }
    get roomId(): string | undefined { return this._roomId; }
    get name() { return this._name; }
    get isBeingCreated(): boolean { return true; }
    get error(): Error | undefined { return this._error; }

    cancel() {
        // TODO: remove from collection somehow
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

class UserIdProfile implements IProfile {
    constructor(public readonly userId: string) {}
    get displayName() { return undefined; }
    get name() { return this.userId; }
    get avatarUrl() { return undefined; }
}
