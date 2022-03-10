/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {ObservableMap} from "../../../observable/map/ObservableMap";
import {Member} from "./Member";
import {LocalMedia} from "../LocalMedia";
import {RoomMember} from "../../room/members/RoomMember";
import type {Options as MemberOptions} from "./Member";
import type {BaseObservableMap} from "../../../observable/map/BaseObservableMap";
import type {Track} from "../../../platform/types/MediaDevices";
import type {SignallingMessage, MGroupCallBase} from "../callEventTypes";
import type {Room} from "../../room/Room";
import type {StateEvent} from "../../storage/types";
import type {Platform} from "../../../platform/web/Platform";
import type {EncryptedMessage} from "../../e2ee/olm/Encryption";
import type {ILogItem} from "../../../logging/types";
import type {Storage} from "../../storage/idb/Storage";

export enum GroupCallState {
    LocalCallFeedUninitialized = "local_call_feed_uninitialized",
    InitializingLocalCallFeed = "initializing_local_call_feed",
    LocalCallFeedInitialized = "local_call_feed_initialized",
    Joining = "entering",
    Joined = "entered",
    Ended = "ended",
}

export type Options = Omit<MemberOptions, "emitUpdate" | "confId" | "encryptDeviceMessage"> & {
    emitUpdate: (call: GroupCall, params?: any) => void;
    encryptDeviceMessage: (roomId: string, message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage>,
    storage: Storage,
    ownDeviceId: string
};

export class GroupCall {
    private readonly _members: ObservableMap<string, Member> = new ObservableMap();
    private localMedia?: Promise<LocalMedia>;
    private _memberOptions: MemberOptions;
    private _state: GroupCallState = GroupCallState.LocalCallFeedInitialized;
    
    // TODO: keep connected state and deal
    constructor(
        private callEvent: StateEvent,
        private readonly room: Room,
        private readonly options: Options
    ) {
        this._memberOptions = Object.assign({
            confId: this.id,
            emitUpdate: member => this._members.update(member.member.userId, member),
            encryptDeviceMessage: (message: SignallingMessage<MGroupCallBase>, log) => {
                return this.options.encryptDeviceMessage(this.room.id, message, log);
            }
        }, options);
    }

    static async create(roomId: string, options: Options): Promise<GroupCall> {

    }

    get members(): BaseObservableMap<string, Member> { return this._members; }

    get id(): string { return this.callEvent.state_key; }

    get isTerminated(): boolean {
        return this.callEvent.content["m.terminated"] === true;
    }

    async join(localMedia: Promise<LocalMedia>) {
        this.localMedia = localMedia;
        const memberContent = await this._createOrUpdateOwnMemberStateContent();
        // send m.call.member state event
        const request = this.options.hsApi.sendState(this.room.id, "m.call.member", this.options.ownUserId, memberContent);
        await request.response();
        // send invite to all members that are < my userId
        for (const [,member] of this._members) {
            member.connect(this.localMedia);
        }
    }

    /** @internal */
    updateCallEvent(callEvent: StateEvent) {
        this.callEvent = callEvent;
        // TODO: emit update
    }

    /** @internal */
    addMember(userId, memberCallInfo) {
        let member = this._members.get(userId);
        if (member) {
            member.updateCallInfo(memberCallInfo);
        } else {
            member = new Member(RoomMember.fromUserId(this.room.id, userId, "join"), this._memberOptions);
            member.updateCallInfo(memberCallInfo);
            this._members.add(userId, member);
        }
    }

    /** @internal */
    removeMember(userId) {
        this._members.remove(userId);
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, log: ILogItem) {
        // TODO: return if we are not membering to the call
        let member = this._members.get(userId);
        if (member) {
            member.handleDeviceMessage(message, deviceId, log);
        } else {
            // we haven't received the m.call.member yet for this caller. buffer the device messages or create the member/call anyway?
        }
    }

    private async _createOrUpdateOwnMemberStateContent() {
        const {storage} = this.options;
        const txn = await storage.readTxn([storage.storeNames.roomState]);
        const stateEvent = await txn.roomState.get(this.room.id, "m.call.member", this.options.ownUserId);
        const stateContent = stateEvent?.event?.content ?? {
            ["m.calls"]: []
        };
        const callsInfo = stateContent["m.calls"];
        let callInfo = callsInfo.find(c => c["m.call_id"] === this.id);
        if (!callInfo) {
            callInfo = {
                ["m.call_id"]: this.id,
                ["m.devices"]: []
            };
            callsInfo.push(callInfo);
        }
        const devicesInfo = callInfo["m.devices"];
        let deviceInfo = devicesInfo.find(d => d["device_id"] === this.options.ownDeviceId);
        if (!deviceInfo) {
            deviceInfo = {
                ["device_id"]: this.options.ownDeviceId
            };
            devicesInfo.push(deviceInfo);
        }
        return stateContent;
    }
}
