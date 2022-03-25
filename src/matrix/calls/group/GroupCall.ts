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
import {EventEmitter} from "../../../utils/EventEmitter";

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

const CALL_TYPE = "m.call";
const CALL_MEMBER_TYPE = "m.call.member";

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

export class GroupCall extends EventEmitter<{change: never}> {
    public readonly id: string;
    private readonly _members: ObservableMap<string, Member> = new ObservableMap();
    private _localMedia?: LocalMedia = undefined;
    private _memberOptions: MemberOptions;
    private _state: GroupCallState;

    constructor(
        id: string | undefined,
        private callContent: Record<string, any> | undefined,
        public readonly roomId: string,
        private readonly options: Options,
        private readonly logItem: ILogItem,
    ) {
        super();
        this.id = id ??  makeId("conf-");
        logItem.set("id", this.id);
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

    join(localMedia: LocalMedia): Promise<void> {
        return this.logItem.wrap("join", async log => {
            if (this._state !== GroupCallState.Created) {
                return;
            }
            this._state = GroupCallState.Joining;
            this._localMedia = localMedia;
            this.emitChange();
            const memberContent = await this._createJoinPayload();
            // send m.call.member state event
            const request = this.options.hsApi.sendState(this.roomId, CALL_MEMBER_TYPE, this.options.ownUserId, memberContent, {log});
            await request.response();
            this.emitChange();
            // send invite to all members that are < my userId
            for (const [,member] of this._members) {
                member.connect(this._localMedia);
            }
        });
    }

    get hasJoined() {
        return this._state === GroupCallState.Joining || this._state === GroupCallState.Joined;
    }

    leave(): Promise<void> {
        return this.logItem.wrap("leave", async log => {
            const memberContent = await this._leaveCallMemberContent();
            // send m.call.member state event
            if (memberContent) {
                const request = this.options.hsApi.sendState(this.roomId, CALL_MEMBER_TYPE, this.options.ownUserId, memberContent, {log});
                await request.response();
                // our own user isn't included in members, so not in the count
                if (this._members.size === 0) {
                    await this.terminate();
                }
            }
        });
    }

    terminate(): Promise<void> {
        return this.logItem.wrap("terminate", async log => {
            if (this._state === GroupCallState.Fledgling) {
                return;
            }
            const request = this.options.hsApi.sendState(this.roomId, CALL_TYPE, this.id, Object.assign({}, this.callContent, {
                "m.terminated": true
            }), {log});
            await request.response();
        });
    }

    /** @internal */
    create(localMedia: LocalMedia, name: string): Promise<void> {
        return this.logItem.wrap("create", async log => {
            if (this._state !== GroupCallState.Fledgling) {
                return;
            }
            this._state = GroupCallState.Creating;
            this.emitChange();
            this.callContent = {
                "m.type": localMedia.cameraTrack ? "m.video" : "m.voice",
                "m.name": name,
                "m.intent": "m.ring"
            };
            const request = this.options.hsApi.sendState(this.roomId, CALL_TYPE, this.id, this.callContent, {log});
            await request.response();
            this._state = GroupCallState.Created;
            this.emitChange();
        });
    }

    /** @internal */
    updateCallEvent(callContent: Record<string, any>, syncLog: ILogItem) {
        this.logItem.wrap("updateCallEvent", log => {
            syncLog.refDetached(log);
            this.callContent = callContent;
            if (this._state === GroupCallState.Creating) {
                this._state = GroupCallState.Created;
            }
            log.set("status", this._state);
            this.emitChange();
        });
    }

    /** @internal */
    addMember(userId: string, memberCallInfo, syncLog: ILogItem) {
        this.logItem.wrap({l: "addMember", id: userId}, log => {
            syncLog.refDetached(log);

            if (userId === this.options.ownUserId) {
                if (this._state === GroupCallState.Joining) {
                    this._state = GroupCallState.Joined;
                    this.emitChange();
                }
                return;
            }
            let member = this._members.get(userId);
            if (member) {
                member.updateCallInfo(memberCallInfo);
            } else {
                const logItem = this.logItem.child("member");
                member = new Member(RoomMember.fromUserId(this.roomId, userId, "join"), memberCallInfo, this._memberOptions, logItem);
                this._members.add(userId, member);
                if (this._state === GroupCallState.Joining || this._state === GroupCallState.Joined) {
                    member.connect(this._localMedia!);
                }
            }
        });
    }

    /** @internal */
    removeMember(userId: string, syncLog: ILogItem) {
        this.logItem.wrap({l: "removeMember", id: userId}, log => {
            syncLog.refDetached(log);
            if (userId === this.options.ownUserId) {
                if (this._state === GroupCallState.Joined) {
                    this._localMedia?.dispose();
                    this._localMedia = undefined;
                    for (const [,member] of this._members) {
                        member.disconnect();
                    }
                    this._state = GroupCallState.Created;
                }
            } else {
                const member = this._members.get(userId);
                if (member) {
                    this._members.remove(userId);
                    member.disconnect();
                }
            }
            this.emitChange();
        });
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, syncLog: ILogItem) {
        // TODO: return if we are not membering to the call
        let member = this._members.get(userId);
        if (member) {
            member.handleDeviceMessage(message, deviceId, syncLog);
        } else {
            const item = this.logItem.log({l: "could not find member for signalling message", userId, deviceId});
            syncLog.refDetached(item);
            // we haven't received the m.call.member yet for this caller. buffer the device messages or create the member/call anyway?
        }
    }

    /** @internal */
    dispose() {
        this.logItem.finish();
    }

    private async _createJoinPayload() {
        const {storage} = this.options;
        const txn = await storage.readTxn([storage.storeNames.roomState]);
        const stateEvent = await txn.roomState.get(this.roomId, CALL_MEMBER_TYPE, this.options.ownUserId);
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
        const stateEvent = await txn.roomState.get(this.roomId, CALL_MEMBER_TYPE, this.options.ownUserId);
        if (stateEvent) {
            const content = stateEvent.event.content;
            const callsInfo = content["m.calls"];
            content["m.calls"] = callsInfo?.filter(c => c["m.call_id"] !== this.id);
            return content;

        }
    }

    protected emitChange() {
        this.emit("change");
        this.options.emitUpdate(this);
    }
}
