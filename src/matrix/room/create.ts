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
import {AttachmentUpload} from "./AttachmentUpload";

import type {HomeServerApi} from "../net/HomeServerApi";
import type {ILogItem} from "../../logging/types";
import type {Platform} from "../../platform/web/Platform";
import type {IBlobHandle} from "../../platform/types/types";

type CreateRoomPayload = {
    is_direct?: boolean;
    preset?: string;
    name?: string;
    topic?: string;
    invite?: string[];
    room_alias_name?: string;
    initial_state: {type: string; state_key: string; content: Record<string, any>}[]
}

type ImageInfo = {
    w: number;
    h: number;
    mimetype: string;
    size: number;
}

type Avatar = {
    info: ImageInfo;
    blob: IBlobHandle;
    name: string;
}

type Options = {
    type: RoomType;
    isEncrypted?: boolean;
    name?: string;
    topic?: string;
    invites?: string[];
    avatar?: Avatar;
    alias?: string;
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
    private _calculatedName: string;
    private _error?: Error;

    constructor(
        public readonly localId: string,
        private readonly options: Options,
        private readonly updateCallback: (self: RoomBeingCreated, params: string | undefined) => void,
        public readonly mediaRepository: MediaRepository,
        public readonly platform: Platform,
        log: ILogItem
    ) {
        super();
        this.isEncrypted = options.isEncrypted === undefined ? defaultE2EEStatusForType(options.type) : options.isEncrypted;
        if (options.name) {
            this._calculatedName = options.name;
        } else {
            const summaryData = {
                joinCount: 1, // ourselves
                inviteCount: (options.invites?.length || 0)
            };
            const userIdProfiles = (options.invites || []).map(userId => new UserIdProfile(userId));
            this._calculatedName = calculateRoomName(userIdProfiles, summaryData, log);
        }
    }

    /** @internal */
    async create(hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        let avatarEventContent;
        if (this.options.avatar) {
            const {avatar} = this.options;
            const attachment = new AttachmentUpload({filename: avatar.name, blob: avatar.blob, platform: this.platform});
            await attachment.upload(hsApi, () => {}, log);
            avatarEventContent = {
                info: avatar.info
            };
            attachment.applyToContent("url", avatarEventContent);
        }
        const createOptions: CreateRoomPayload = {
            is_direct: this.options.type === RoomType.DirectMessage,
            preset: presetForType(this.options.type),
            initial_state: []
        };
        if (this.options.name) {
            createOptions.name = this.options.name;
        }
        if (this.options.topic) {
            createOptions.topic = this.options.topic;
        }
        if (this.options.invites) {
            createOptions.invite = this.options.invites;
        }
        if (this.options.alias) {
            createOptions.room_alias_name = this.options.alias;
        }
        if (this.isEncrypted) {
            createOptions.initial_state.push(createRoomEncryptionEvent());
        }
        if (avatarEventContent) {
            createOptions.initial_state.push({
                type: "m.room.avatar",
                state_key: "",
                content: avatarEventContent
            });
        }
        try {
            const response = await hsApi.createRoom(createOptions, {log}).response();
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
        if (!this.options.name && this.options.invites) {
            this.profiles = await loadProfiles(this.options.invites, hsApi, log);
            const summaryData = {
                joinCount: 1, // ourselves
                inviteCount: this.options.invites.length
            };
            this._calculatedName = calculateRoomName(this.profiles, summaryData, log);
            this.emitChange();
        }
    }

    private emitChange(params?: string) {
        this.updateCallback(this, params);
        this.emit("change");
    }

    get avatarColorId(): string { return this.options.invites?.[0] ?? this._roomId ?? this.localId; }
    get avatarUrl(): string | undefined { return this.profiles?.[0].avatarUrl; }
    get avatarBlobUrl(): string | undefined { return this.options.avatar?.blob?.url; }
    get roomId(): string | undefined { return this._roomId; }
    get name() { return this._calculatedName; }
    get isBeingCreated(): boolean { return true; }
    get error(): Error | undefined { return this._error; }
    get id() { return this.localId; }
    
    cancel() {
        // TODO: remove from collection somehow
    }

    dispose() {
        if (this.options.avatar) {
            this.options.avatar.blob.dispose();
        }
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
