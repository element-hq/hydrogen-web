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

import {ObservableMap} from "../../observable/map/ObservableMap";
import {WebRTC, PeerConnection, PeerConnectionHandler} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";
import {handlesEventType} from "./PeerCall";
import {EventType} from "./callEventTypes";
import {GroupCall} from "./group/GroupCall";

import type {Room} from "../room/Room";
import type {MemberChange} from "../room/members/RoomMember";
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";
import type {Platform} from "../../platform/web/Platform";
import type {BaseObservableMap} from "../../observable/map/BaseObservableMap";
import type {SignallingMessage, MGroupCallBase} from "./callEventTypes";
import type {Options as GroupCallOptions} from "./group/GroupCall";

const GROUP_CALL_TYPE = "m.call";
const GROUP_CALL_MEMBER_TYPE = "m.call.member";
const CALL_TERMINATED = "m.terminated";

export type Options = Omit<GroupCallOptions, "emitUpdate">;

export class GroupCallHandler {
    // group calls by call id
    private readonly _calls: ObservableMap<string, GroupCall> = new ObservableMap<string, GroupCall>();
    // map of userId to set of conf_id's they are in
    private memberToCallIds: Map<string, Set<string>> = new Map();
    private groupCallOptions: GroupCallOptions;

    constructor(private readonly options: Options) {
        this.groupCallOptions = Object.assign({}, this.options, {
            emitUpdate: (groupCall, params) => this._calls.update(groupCall.id, params)
        });
    }

    get calls(): BaseObservableMap<string, GroupCall> { return this._calls; }

    // TODO: check and poll turn server credentials here

    /** @internal */
    handleRoomState(room: Room, events: StateEvent[], log: ILogItem) {
        // first update call events
        for (const event of events) {
            if (event.type === EventType.GroupCall) {
                this.handleCallEvent(event, room);
            }
        }
        // then update members
        for (const event of events) {
            if (event.type === EventType.GroupCallMember) {
                this.handleCallMemberEvent(event);
            }
        }
    }

    /** @internal */
    updateRoomMembers(room: Room, memberChanges: Map<string, MemberChange>) {

    }

    /** @internal */
    handlesDeviceMessageEventType(eventType: string): boolean {
        return handlesEventType(eventType);
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, userId: string, deviceId: string, log: ILogItem) {
        // TODO: buffer messages for calls we haven't received the state event for yet?
        const call = this._calls.get(message.content.conf_id);
        call?.handleDeviceMessage(message, userId, deviceId, log);
    }

    private handleCallEvent(event: StateEvent, room: Room) {
        const callId = event.state_key;
        let call = this._calls.get(callId);
        if (call) {
            call.updateCallEvent(event);
            if (call.isTerminated) {
                this._calls.remove(call.id);
            }
        } else {
            call = new GroupCall(event, room, this.groupCallOptions);
            this._calls.set(call.id, call);
        }
    }

    private handleCallMemberEvent(event: StateEvent) {
        const userId = event.state_key;
        const calls = event.content["m.calls"] ?? [];
        const newCallIdsMemberOf = new Set<string>(calls.map(call => {
            const callId = call["m.call_id"];
            const groupCall = this._calls.get(callId);
            // TODO: also check the member when receiving the m.call event
            groupCall?.addMember(userId, call);
            return callId;
        }));
        let previousCallIdsMemberOf = this.memberToCallIds.get(userId);
        // remove user as member of any calls not present anymore
        if (previousCallIdsMemberOf) {
            for (const previousCallId of previousCallIdsMemberOf) {
                if (!newCallIdsMemberOf.has(previousCallId)) {
                    const groupCall = this._calls.get(previousCallId);
                    groupCall?.removeMember(userId);
                }
            }
        }
        if (newCallIdsMemberOf.size === 0) {
            this.memberToCallIds.delete(userId);
        } else {
            this.memberToCallIds.set(userId, newCallIdsMemberOf);
        }
    }
}

