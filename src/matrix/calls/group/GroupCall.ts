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
import {EventEmitter} from "../../../utils/EventEmitter";
import {EventType, CallIntent} from "../callEventTypes";

import type {Options as MemberOptions} from "./Member";
import type {BaseObservableMap} from "../../../observable/map/BaseObservableMap";
import type {Track} from "../../../platform/types/MediaDevices";
import type {SignallingMessage, MGroupCallBase, CallMembership} from "../callEventTypes";
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

function getMemberKey(userId: string, deviceId: string) {
    return JSON.stringify(userId)+`,`+JSON.stringify(deviceId);
}

function memberKeyIsForUser(key: string, userId: string) {
    return key.startsWith(JSON.stringify(userId)+`,`);
}

function getDeviceFromMemberKey(key: string): string {
    return JSON.parse(`[${key}]`)[1];
}

export type Options = Omit<MemberOptions, "emitUpdate" | "confId" | "encryptDeviceMessage"> & {
    emitUpdate: (call: GroupCall, params?: any) => void;
    encryptDeviceMessage: (roomId: string, userId: string, message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage>,
    storage: Storage,
};

export class GroupCall extends EventEmitter<{change: never}> {
    private readonly _members: ObservableMap<string, Member> = new ObservableMap();
    private _localMedia?: LocalMedia = undefined;
    private _memberOptions: MemberOptions;
    private _state: GroupCallState;

    constructor(
        public readonly id: string,
        newCall: boolean,
        private callContent: Record<string, any>,
        public readonly roomId: string,
        private readonly options: Options,
        private readonly logItem: ILogItem,
    ) {
        super();
        logItem.set("id", this.id);
        this._state = newCall ? GroupCallState.Fledgling : GroupCallState.Created;
        this._memberOptions = Object.assign({}, options, {
            confId: this.id,
            emitUpdate: member => this._members.update(getMemberKey(member.userId, member.deviceId), member),
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

    get isRinging(): boolean {
        return this._state === GroupCallState.Created && this.intent === "m.ring" && !this.isMember(this.options.ownUserId);
    }

    get name(): string {
        return this.callContent?.["m.name"];
    }

    get intent(): CallIntent {
        return this.callContent?.["m.intent"];
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
            const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCallMember, this.options.ownUserId, memberContent, {log});
            await request.response();
            this.emitChange();
            // send invite to all members that are < my userId
            for (const [,member] of this._members) {
                member.connect(this._localMedia!.clone());
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
                const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCallMember, this.options.ownUserId, memberContent, {log});
                await request.response();
                // our own user isn't included in members, so not in the count
                if (this.intent === CallIntent.Ring && this._members.size === 0) {
                    await this.terminate();
                }
            } else {
                log.set("already_left", true);
            }
        });
    }

    terminate(): Promise<void> {
        return this.logItem.wrap("terminate", async log => {
            if (this._state === GroupCallState.Fledgling) {
                return;
            }
            const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCall, this.id, Object.assign({}, this.callContent, {
                "m.terminated": true
            }), {log});
            await request.response();
        });
    }

    /** @internal */
    create(callType: "m.video" | "m.voice"): Promise<void> {
        return this.logItem.wrap("create", async log => {
            if (this._state !== GroupCallState.Fledgling) {
                return;
            }
            this._state = GroupCallState.Creating;
            this.emitChange();
            this.callContent = Object.assign({
                "m.type": callType,
            }, this.callContent);
            const request = this.options.hsApi.sendState(this.roomId, EventType.GroupCall, this.id, this.callContent!, {log});
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
    updateMembership(userId: string, callMembership: CallMembership, syncLog: ILogItem) {
        this.logItem.wrap({l: "updateMember", id: userId}, log => {
            syncLog.refDetached(log);
            const devices = callMembership["m.devices"];
            const previousDeviceIds = this.getDeviceIdsForUserId(userId);
            for (const device of devices) {
                const deviceId = device.device_id;
                const memberKey = getMemberKey(userId, deviceId);
                log.wrap({l: "update device member", id: memberKey}, log => {
                    if (userId === this.options.ownUserId && deviceId === this.options.ownDeviceId) {
                        if (this._state === GroupCallState.Joining) {
                            log.set("update_own", true);
                            this._state = GroupCallState.Joined;
                            this.emitChange();
                        }
                    } else {
                        let member = this._members.get(memberKey);
                        if (member) {
                            log.set("update", true);
                            member!.updateCallInfo(device);
                        } else {
                            const logItem = this.logItem.child({l: "member", id: memberKey});
                            log.set("add", true);
                            log.refDetached(logItem);
                            member = new Member(
                                RoomMember.fromUserId(this.roomId, userId, "join"),
                                device, this._memberOptions, logItem
                            );
                            this._members.add(memberKey, member);
                            if (this._state === GroupCallState.Joining || this._state === GroupCallState.Joined) {
                                // Safari can't send a MediaStream to multiple sources, so clone it
                                member.connect(this._localMedia!.clone());
                            }
                        }
                    }
                });
            }

            const newDeviceIds = new Set<string>(devices.map(call => call.device_id));
            // remove user as member of any calls not present anymore
            for (const previousDeviceId of previousDeviceIds) {
                if (!newDeviceIds.has(previousDeviceId)) {
                    log.wrap({l: "remove device member", id: getMemberKey(userId, previousDeviceId)}, log => {
                        this.removeMemberDevice(userId, previousDeviceId, log);
                    });
                }
            }
            if (userId === this.options.ownUserId && !newDeviceIds.has(this.options.ownDeviceId)) {
                this.removeOwnDevice(log);
            }
        });
    }

    /** @internal */
    removeMembership(userId: string, syncLog: ILogItem) {
        const deviceIds = this.getDeviceIdsForUserId(userId);
        this.logItem.wrap("removeMember", log => {
            syncLog.refDetached(log);
            for (const deviceId of deviceIds) {
                this.removeMemberDevice(userId, deviceId, log);
            }
            if (userId === this.options.ownUserId) {
                this.removeOwnDevice(log);
            }
        });
    }

    private getDeviceIdsForUserId(userId: string): string[] {
        return Array.from(this._members.keys())
            .filter(key => memberKeyIsForUser(key, userId))
            .map(key => getDeviceFromMemberKey(key));
    }

    private isMember(userId: string): boolean {
        return Array.from(this._members.keys()).some(key => memberKeyIsForUser(key, userId));
    }

    private removeOwnDevice(log: ILogItem) {
        if (this._state === GroupCallState.Joined) {
            log.set("leave_own", true);
            for (const [,member] of this._members) {
                member.disconnect(true);
            }
            this._localMedia?.dispose();
            this._localMedia = undefined;
            this._state = GroupCallState.Created;
            this.emitChange();
        }
    }

    /** @internal */
    private removeMemberDevice(userId: string, deviceId: string, log: ILogItem) {
        const memberKey = getMemberKey(userId, deviceId);
        log.wrap({l: "removeMemberDevice", id: memberKey}, log => {
            const member = this._members.get(memberKey);
            if (member) {
                log.set("leave", true);
                this._members.remove(memberKey);
                member.disconnect(false);
            }
            this.emitChange();
        });
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, syncLog: ILogItem) {
        // TODO: return if we are not membering to the call
        let member = this._members.get(getMemberKey(userId, deviceId));
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
        const stateEvent = await txn.roomState.get(this.roomId, EventType.GroupCallMember, this.options.ownUserId);
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
        callInfo["m.devices"] = callInfo["m.devices"].filter(d => d["device_id"] !== this.options.ownDeviceId);
        callInfo["m.devices"].push({
            ["device_id"]: this.options.ownDeviceId,
            ["session_id"]: this.options.sessionId,
            feeds: [{purpose: "m.usermedia"}]
        });
        return stateContent;
    }

    private async _leaveCallMemberContent(): Promise<Record<string, any> | undefined> {
        const {storage} = this.options;
        const txn = await storage.readTxn([storage.storeNames.roomState]);
        const stateEvent = await txn.roomState.get(this.roomId, EventType.GroupCallMember, this.options.ownUserId);
        if (stateEvent) {
            const content = stateEvent.event.content;
            const callInfo = content["m.calls"]?.find(c => c["m.call_id"] === this.id);
            if (callInfo) {
                const devicesInfo = callInfo["m.devices"];
                const deviceIndex = devicesInfo.findIndex(d => d["device_id"] === this.options.ownDeviceId);
                if (deviceIndex !== -1) {
                    devicesInfo.splice(deviceIndex, 1);
                    return content;
                }
            }

        }
    }

    protected emitChange() {
        this.emit("change");
        this.options.emitUpdate(this);
    }
}
