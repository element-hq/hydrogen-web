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

const GROUP_CALL_TYPE = "m.call";
const GROUP_CALL_MEMBER_TYPE = "m.call.member";

enum CallSetupMessageType {
    Invite = "m.call.invite",
    Answer = "m.call.answer",
    Candidates = "m.call.candidates",
    Hangup = "m.call.hangup",
}

const CALL_ID = "m.call_id";
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
                    const call = this.calls.get(source[CALL_ID]);
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

    handleDeviceMessage(senderUserId: string, senderDeviceId: string, eventType: string, content: Record<string, any>, log: ILogItem) {
        const callId = content[CALL_ID];
        const call = this.calls.get(callId);
        call?.handleDeviceMessage(senderUserId, senderDeviceId, eventType, content, log);
    }
}

function participantId(senderUserId: string, senderDeviceId: string | null) {
    return JSON.stringify(senderUserId) + JSON.stringify(senderDeviceId);
}

class GroupParticipant implements PeerCallHandler {
    private peerCall?: PeerCall;

    constructor(
        private readonly userId: string,
        private readonly deviceId: string,
        private localMedia: LocalMedia | undefined,
        private readonly webRTC: WebRTC,
        private readonly hsApi: HomeServerApi
    ) {}

    sendInvite() {
        this.peerCall = new PeerCall(this, this.webRTC);
        this.peerCall.setLocalMedia(this.localMedia);
        this.peerCall.sendOffer();
    }

    /** From PeerCallHandler
     * @internal */
    override emitUpdate() {

    }

    /** From PeerCallHandler
     * @internal */
    override onSendSignallingMessage() {
        // TODO: this needs to be encrypted with olm first
        this.hsApi.sendToDevice(type, {[this.userId]: {[this.deviceId ?? "*"]: content}});
    }
}

class GroupCall {
    private readonly participants: ObservableMap<string, Participant> = new ObservableMap();
    private localMedia?: LocalMedia;

    constructor(private readonly ownUserId: string, private callEvent: StateEvent, private readonly room: Room, private readonly webRTC: WebRTC) {

    }

    get id(): string { return this.callEvent.state_key; }

    async participate(tracks: Track[]) {
        this.localMedia = LocalMedia.fromTracks(tracks);
        for (const [,participant] of this.participants) {
            participant.setLocalMedia(this.localMedia.clone());
        }
        // send m.call.member state event

        // send invite to all participants that are < my userId
        for (const [,participant] of this.participants) {
            if (participant.userId < this.ownUserId) {
                participant.sendInvite();
            }
        }
    }

    updateCallEvent(callEvent: StateEvent) {
        this.callEvent = callEvent;
    }

    addParticipant(userId, source) {
        const participantId = getParticipantId(userId, source.device_id);
        const participant = this.participants.get(participantId);
        if (participant) {
            participant.updateSource(source);
        } else {
            participant.add(participantId, new GroupParticipant(userId, source.device_id, this.localMedia?.clone(), this.webRTC));
        }
    }

    handleDeviceMessage(senderUserId: string, senderDeviceId: string, eventType: string, content: Record<string, any>, log: ILogItem) {
        const participantId = getParticipantId(senderUserId, senderDeviceId);
        let peerCall = this.participants.get(participantId);
        let hasDeviceInKey = true;
        if (!peerCall) {
            hasDeviceInKey = false;
            peerCall = this.participants.get(getParticipantId(senderUserId, null))
        }
        if (peerCall) {
            peerCall.handleIncomingSignallingMessage(eventType, content, senderDeviceId);
            if (!hasDeviceInKey && peerCall.opponentPartyId) {
                this.participants.delete(getParticipantId(senderUserId, null));
                this.participants.add(getParticipantId(senderUserId, peerCall.opponentPartyId));
            }
        } else {
            // create peerCall
        }
    }

    get id(): string {
        return this.callEvent.state_key;
    }

    get isTerminated(): boolean {
        return !!this.callEvent.content[CALL_TERMINATED];
    }
}
