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

import type {Room} from "../room/Room";
import type {MemberChange} from "../room/members/RoomMember";
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";
import type {Platform} from "../../platform/web/Platform";

import {WebRTC, PeerConnection, PeerConnectionHandler, StreamPurpose} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";
import {handlesEventType, PeerCall, PeerCallHandler} from "./PeerCall";
import {EventType} from "./callEventTypes";
import type {SignallingMessage, MGroupCallBase} from "./callEventTypes";
import type {GroupCall} from "./group/GroupCall";

const GROUP_CALL_TYPE = "m.call";
const GROUP_CALL_MEMBER_TYPE = "m.call.member";
const CALL_TERMINATED = "m.terminated";

export class GroupCallHandler {

    private createPeerCall: (callId: string, handler: PeerCallHandler) => PeerCall;
    // group calls by call id
    public readonly calls: ObservableMap<string, GroupCall> = new ObservableMap<string, GroupCall>();
    // map of userId to set of conf_id's they are in
    private memberToCallIds: Map<string, Set<string>> = new Map();

    constructor(hsApi: HomeServerApi, platform: Platform, ownUserId: string, ownDeviceId: string) {
        this.createPeerCall = (callId: string, handler: PeerCallHandler) => {
            return new PeerCall(callId, handler, platform.createTimeout, platform.webRTC);
        }
    }

    // TODO: check and poll turn server credentials here

    handleRoomState(room: Room, events: StateEvent[], log: ILogItem) {
        // first update call events
        for (const event of events) {
            if (event.type === EventType.GroupCall) {
                this.handleCallEvent(event);
            }
        }
        // then update participants
        for (const event of events) {
            if (event.type === EventType.GroupCallMember) {
                this.handleCallMemberEvent(event);
            }
        }
    }

    updateRoomMembers(room: Room, memberChanges: Map<string, MemberChange>) {

    }

    private handleCallEvent(event: StateEvent) {
        const callId = event.state_key;
        let call = this.calls.get(callId);
        if (call) {
            call.updateCallEvent(event);
            if (call.isTerminated) {
                this.calls.remove(call.id);
            }
        } else {
            call = new GroupCall(event, room, this.createPeerCall);
            this.calls.set(call.id, call);
        }
    }

    private handleCallMemberEvent(event: StateEvent) {
        const participant = event.state_key;
        const calls = event.content["m.calls"] ?? [];
        const newCallIdsMemberOf = new Set<string>(calls.map(call => {
            const callId = call["m.call_id"];
            const groupCall = this.calls.get(callId);
            // TODO: also check the participant when receiving the m.call event
            groupCall?.addParticipant(participant, call);
            return callId;
        }));
        let previousCallIdsMemberOf = this.memberToCallIds.get(participant);
        // remove user as participant of any calls not present anymore
        if (previousCallIdsMemberOf) {
            for (const previousCallId of previousCallIdsMemberOf) {
                if (!newCallIdsMemberOf.has(previousCallId)) {
                    const groupCall = this.calls.get(previousCallId);
                    groupCall?.removeParticipant(participant);
                }
            }
        }
        if (newCallIdsMemberOf.size === 0) {
            this.memberToCallIds.delete(participant);
        } else {
            this.memberToCallIds.set(participant, newCallIdsMemberOf);
        }
    }

    handlesDeviceMessageEventType(eventType: string): boolean {
        return handlesEventType(eventType);
    }

    handleDeviceMessage(senderUserId: string, senderDeviceId: string, event: SignallingMessage<MGroupCallBase>, log: ILogItem) {
        // TODO: buffer messages for calls we haven't received the state event for yet?
        const call = this.calls.get(event.content.conf_id);
        call?.handleDeviceMessage(senderUserId, senderDeviceId, event, log);
    }
}

