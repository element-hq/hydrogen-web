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
import {loadProfiles, Profile, UserIdProfile} from "../profile";
import {RoomType, RoomVisibility, UnsentStateEvent} from "./common";

import type {HomeServerApi} from "../net/HomeServerApi";
import type {ILogItem} from "../../logging/types";
import type {Platform} from "../../platform/web/Platform";
import type {IBlobHandle} from "../../platform/types/types";
import type {User} from "../User";
import type {Storage} from "../storage/idb/Storage";

type CreateRoomPayload = {
    is_direct?: boolean;
    preset?: string;
    name?: string;
    topic?: string;
    invite?: string[];
    room_alias_name?: string;
    creation_content?: {"m.federate"?: boolean, type?: string};
    initial_state: UnsentStateEvent[];
    power_level_content_override?: Record<string, any>;
}

type ImageInfo = {
    w: number;
    h: number;
    mimetype: string;
    size: number;
}

type Avatar = {
    info: ImageInfo;
    name: string;
} & ({ blob: IBlobHandle } | { url: string });

type Options = {
    type?: RoomType;
    visibility: RoomVisibility;
    isEncrypted?: boolean;
    isFederationDisabled?: boolean;
    name?: string;
    topic?: string;
    invites?: string[];
    avatar?: Avatar;
    alias?: string;
    powerLevelContentOverride?: Record<string, any>;
    initialState?: any[];
}

function defaultE2EEStatusForType(type: RoomVisibility): boolean {
    switch (type) {
        case RoomVisibility.DirectMessage:
        case RoomVisibility.Private:
            return true;
        case RoomVisibility.Public:
            return false;
    }
}

function presetForType(type: RoomVisibility): string {
    switch (type) {
        case RoomVisibility.DirectMessage:
            return "trusted_private_chat";
        case RoomVisibility.Private:
            return "private_chat";
        case RoomVisibility.Public:
            return "public_chat";
    }
}

export class RoomBeingCreated extends EventEmitter<{change: never}> {
    private _roomId?: string;
    private profiles: Profile[] = [];

    public readonly isEncrypted: boolean;
    private _calculatedName: string;
    private _error?: Error;
    private _isCancelled = false;

    constructor(
        public readonly id: string,
        private readonly options: Options,
        private readonly updateCallback: (self: RoomBeingCreated, params: string | undefined) => void,
        public readonly mediaRepository: MediaRepository,
        public readonly platform: Platform,
        log: ILogItem
    ) {
        super();
        this.isEncrypted = options.isEncrypted === undefined ? defaultE2EEStatusForType(options.visibility) : options.isEncrypted;
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
        try {
            let avatarEventContent;
            if (this.options.avatar) {
                const {avatar} = this.options;

                avatarEventContent = {
                    info: avatar.info
                };

                if ("blob" in avatar) {
                    const attachment = new AttachmentUpload({filename: avatar.name, blob: avatar.blob, platform: this.platform});
                    await attachment.upload(hsApi, () => {}, log);
                    attachment.applyToContent("url", avatarEventContent);
                } else {
                    avatarEventContent.url = avatar.url;
                }
            }
            const createOptions: CreateRoomPayload = {
                is_direct: this.options.visibility === RoomVisibility.DirectMessage,
                preset: presetForType(this.options.visibility),
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
            if (this.options.type !== undefined) {
                let type: string | undefined = undefined;
                if (this.options.type === RoomType.World) type =  "org.matrix.msc3815.world";
                if (this.options.type === RoomType.Profile) type =  "org.matrix.msc3815.profile";
                createOptions.creation_content = { type };
            }
            if (this.options.isFederationDisabled === true) {
                if (createOptions.creation_content === undefined) createOptions.creation_content = {};
                createOptions.creation_content["m.federate"] = false;
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
            if (this.options.powerLevelContentOverride) {
                createOptions.power_level_content_override = this.options.powerLevelContentOverride;
            }

            if (this.options.initialState) {
                createOptions.initial_state.push(...this.options.initialState);
            }

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
        try {
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
        } catch (err) {} // swallow error, loading profiles is not essential
    }

    private emitChange(params?: string) {
        this.updateCallback(this, params);
        this.emit("change");
    }

    get avatarColorId(): string { return this.options.invites?.[0] ?? this._roomId ?? this.id; }
    get avatarUrl(): string | undefined { return this.profiles?.[0]?.avatarUrl; }
    get avatarBlobUrl(): string | undefined {
        const avatar = this.options.avatar;

        if (!avatar || !("blob" in avatar)) {
            return undefined;
        }

        return avatar.blob.url;
    }
    get roomId(): string | undefined { return this._roomId; }
    get name() { return this._calculatedName; }
    get isBeingCreated(): boolean { return true; }
    get error(): Error | undefined { return this._error; }

    cancel() {
        if (!this._isCancelled) {
            this.dispose();
            this._isCancelled = true;
            this.emitChange("isCancelled");
        }
    }
    // called from Session when updateCallback is invoked to remove it from the collection
    get isCancelled() { return this._isCancelled; }

    /** @internal */
    dispose() {
        if (this.options.avatar && "blob" in this.options.avatar) {
            this.options.avatar.blob.dispose();
        }
    }

    async adjustDirectMessageMapIfNeeded(user: User, storage: Storage, hsApi: HomeServerApi, log: ILogItem): Promise<void> {
        if (!this.options.invites || this.options.visibility !== RoomVisibility.DirectMessage) {
            return;
        }
        const userId = this.options.invites[0];
        const DM_MAP_TYPE = "m.direct";
        await log.wrap("set " + DM_MAP_TYPE, async log => {
            try {
                const txn = await storage.readWriteTxn([storage.storeNames.accountData]);
                let mapEntry;
                try {
                    mapEntry = await txn.accountData.get(DM_MAP_TYPE);
                    if (!mapEntry) {
                        mapEntry = {type: DM_MAP_TYPE, content: {}};
                    }
                    const map = mapEntry.content;
                    let userRooms = map[userId];
                    if (!userRooms) {
                        map[userId] = userRooms = [];
                    }
                    // this is a new room id so no need to check if it's already there
                    userRooms.push(this._roomId);
                    txn.accountData.set(mapEntry);
                    await txn.complete();
                } catch (err) {
                    txn.abort();
                    throw err;
                }
                await hsApi.setAccountData(user.id, DM_MAP_TYPE, mapEntry.content, {log}).response();
            } catch (err) {
                // we can't really do anything else but logging here
                log.catch(err);
            }
        });
    }
}
