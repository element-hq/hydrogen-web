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
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";

import {WebRTC, PeerConnection, PeerConnectionHandler, StreamPurpose} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";
import type {SignallingMessage} from "./PeerCall";
import type {MGroupCallBase} from "./callEventTypes";

const GROUP_CALL_TYPE = "m.call";
const GROUP_CALL_MEMBER_TYPE = "m.call.member";

enum CallSetupMessageType {
    Invite = "m.call.invite",
    Answer = "m.call.answer",
    Candidates = "m.call.candidates",
    Hangup = "m.call.hangup",
}

const CONF_ID = "conf_id";
const CALL_TERMINATED = "m.terminated";

export class GroupCallHandler {
    // group calls by call id
    public readonly calls: ObservableMap<string, GroupCall> = new ObservableMap<string, GroupCall>();

    constructor() {

    }

    // TODO: check and poll turn server credentials here

    handleRoomState(room: Room, events: StateEvent[], log: ILogItem) {
        // first update call events
        for (const event of events) {
            if (event.type === GROUP_CALL_TYPE) {
                const callId = event.state_key;
                let call = this.calls.get(callId);
                if (call) {
                    call.updateCallEvent(event);
                    if (call.isTerminated) {
                        this.calls.remove(call.id);
                    }
                } else {
                    call = new GroupCall(event, room);
                    this.calls.set(call.id, call);
                }
            }
        }
        // then update participants
        for (const event of events) {
            if (event.type === GROUP_CALL_MEMBER_TYPE) {
                const participant = event.state_key;
                const sources = event.content["m.sources"];
                for (const source of sources) {
                    const call = this.calls.get(source[CONF_ID]);
                    if (call && !call.isTerminated) {
                        call.addParticipant(participant, source);
                    }
                }
            }
        }
    }

    handlesDeviceMessageEventType(eventType: string | undefined): boolean {
        return  eventType === CallSetupMessageType.Invite ||
                eventType === CallSetupMessageType.Candidates ||
                eventType === CallSetupMessageType.Answer ||
                eventType === CallSetupMessageType.Hangup;
    }

    handleDeviceMessage(senderUserId: string, senderDeviceId: string, event: SignallingMessage<MGroupCallBase>, log: ILogItem) {
        const call = this.calls.get(event.content.conf_id);
        call?.handleDeviceMessage(senderUserId, senderDeviceId, event, log);
    }
}

