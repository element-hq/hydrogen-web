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
import {makeId} from "../../common";

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
    Fledgling = "fledgling",
    Creating = "creating",
    Created = "created",
    Joining = "joining",
    Joined = "joined",
}

export type Options = Omit<MemberOptions, "emitUpdate" | "confId" | "encryptDeviceMessage"> & {
    emitUpdate: (call: GroupCall, params?: any) => void;
    encryptDeviceMessage: (roomId: string, userId: string, message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage>,
    storage: Storage,
    ownDeviceId: string
};

export class GroupCall {
    public readonly id: string;
    private readonly _members: ObservableMap<string, Member> = new ObservableMap();
    private _localMedia?: LocalMedia = undefined;
    private _memberOptions: MemberOptions;
    private _state: GroupCallState;

    constructor(
        id: string | undefined,
        private callContent: Record<string, any> | undefined,
        public readonly roomId: string,
        private readonly options: Options
    ) {
        this.id = id ??  makeId("conf-");
        this._state = id ? GroupCallState.Created : GroupCallState.Fledgling;
        this._memberOptions = Object.assign({}, options, {
            confId: this.id,
            emitUpdate: member => this._members.update(member.member.userId, member),
            encryptDeviceMessage: (userId: string, message: SignallingMessage<MGroupCallBase>, log) => {
                return this.options.encryptDeviceMessage(this.roomId, userId, message, log);
            }
        });
    }

    get localMedia(): LocalMedia | undefined { return this._localMedia; }
    get members(): BaseObservableMap<string, Member> { return this._members; }

    get isTerminated(): boolean {
        return this.callContent?.["m.terminated"] === true;
    }

    get name(): string {
        return this.callContent?.["m.name"];
    }

    async join(localMedia: LocalMedia) {
        if (this._state !== GroupCallState.Created) {
            return;
        }
        this._state = GroupCallState.Joining;
        this._localMedia = localMedia;
        this.options.emitUpdate(this);
        const memberContent = await this._joinCallMemberContent();
        // send m.call.member state event
        const request = this.options.hsApi.sendState(this.roomId, "m.call.member", this.options.ownUserId, memberContent);
        await request.response();
        this.options.emitUpdate(this);
        // send invite to all members that are < my userId
        for (const [,member] of this._members) {
            member.connect(this._localMedia);
        }
    }

    get hasJoined() {
        return this._state === GroupCallState.Joining || this._state === GroupCallState.Joined;
    }

    async leave() {
        const memberContent = await this._leaveCallMemberContent();
        // send m.call.member state event
        if (memberContent) {
            const request = this.options.hsApi.sendState(this.roomId, "m.call.member", this.options.ownUserId, memberContent);
            await request.response();
        }
    }

    /** @internal */
    async create(localMedia: LocalMedia, name: string) {
        if (this._state !== GroupCallState.Fledgling) {
            return;
        }
        this._state = GroupCallState.Creating;
        this.callContent = {
            "m.type": localMedia.cameraTrack ? "m.video" : "m.voice",
            "m.name": name,
            "m.intent": "m.ring"
        };
        const request = this.options.hsApi.sendState(this.roomId, "m.call", this.id, this.callContent);
        await request.response();
        this._state = GroupCallState.Created;
    }

    /** @internal */
    updateCallEvent(callContent: Record<string, any>) {
        this.callContent = callContent;
        if (this._state === GroupCallState.Creating) {
            this._state = GroupCallState.Created;
        }
    }

    /** @internal */
    addMember(userId, memberCallInfo) {
        if (userId === this.options.ownUserId) {
            if (this._state === GroupCallState.Joining) {
                this._state = GroupCallState.Joined;
            }
            return;
        }
        let member = this._members.get(userId);
        if (member) {
            member.updateCallInfo(memberCallInfo);
        } else {
            member = new Member(RoomMember.fromUserId(this.roomId, userId, "join"), memberCallInfo, this._memberOptions);
            this._members.add(userId, member);
            if (this._state === GroupCallState.Joining || this._state === GroupCallState.Joined) {
                member.connect(this._localMedia!);
            }
        }
    }

    /** @internal */
    removeMember(userId) {
        if (userId === this.options.ownUserId) {
            if (this._state === GroupCallState.Joined) {
                this._state = GroupCallState.Created;
            }
            return;
        }
        this._members.remove(userId);
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, log: ILogItem) {
        console.log("incoming to_device call signalling message from", userId, deviceId, message);
        // TODO: return if we are not membering to the call
        let member = this._members.get(userId);
        if (member) {
            member.handleDeviceMessage(message, deviceId, log);
        } else {
            // we haven't received the m.call.member yet for this caller. buffer the device messages or create the member/call anyway?
        }
    }

    private async _joinCallMemberContent() {
        const {storage} = this.options;
        const txn = await storage.readTxn([storage.storeNames.roomState]);
        const stateEvent = await txn.roomState.get(this.roomId, "m.call.member", this.options.ownUserId);
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

    private async _leaveCallMemberContent(): Promise<Record<string, any> | undefined> {
        const {storage} = this.options;
        const txn = await storage.readTxn([storage.storeNames.roomState]);
        const stateEvent = await txn.roomState.get(this.roomId, "m.call.member", this.options.ownUserId);
        const callsInfo = stateEvent?.event?.content?.["m.calls"];
        callsInfo?.filter(c => c["m.call_id"] === this.id);
        return stateEvent?.event.content;
    }
}
