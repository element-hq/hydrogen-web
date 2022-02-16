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

export class CallHandler {
    // group calls by call id
    public readonly groupCalls: ObservableMap<string, GroupCall> = new ObservableMap<string, GroupCall>();

    constructor() {

    }

    handleRoomState(room: Room, events: StateEvent[], log: ILogItem) {
        // first update call events
        for (const event of events) {
            if (event.type === GROUP_CALL_TYPE) {
                const callId = event.state_key;
                let call = this.groupCalls.get(callId);
                if (call) {
                    call.updateCallEvent(event);
                    if (call.isTerminated) {
                        this.groupCalls.remove(call.id);
                    }
                } else {
                    call = new GroupCall(event, room);
                    this.groupCalls.set(call.id, call);
                }
            }
        }
        // then update participants
        for (const event of events) {
            if (event.type === GROUP_CALL_MEMBER_TYPE) {
                const participant = event.state_key;
                const sources = event.content["m.sources"];
                for (const source of sources) {
                    const call = this.groupCalls.get(source[CALL_ID]);
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
        const call = this.groupCalls.get(callId);
        call?.handleDeviceMessage(senderUserId, senderDeviceId, eventType, content, log);
    }
}

function peerCallKey(senderUserId: string, senderDeviceId: string) {
    return JSON.stringify(senderUserId) + JSON.stringify(senderDeviceId);
}

class GroupCall {
    private peerCalls: Map<string, PeerCall>

    constructor(private callEvent: StateEvent, private readonly room: Room) {

    }

    updateCallEvent(callEvent: StateEvent) {
        this.callEvent = callEvent;
    }

    addParticipant(userId, source) {

    }

    handleDeviceMessage(senderUserId: string, senderDeviceId: string, eventType: string, content: Record<string, any>, log: ILogItem) {
        const peerCall = this.peerCalls.get(peerCallKey(senderUserId, senderDeviceId));
        peerCall?.handleIncomingSignallingMessage()
    }

    get id(): string {
        return this.callEvent.state_key;
    }

    get isTerminated(): boolean {
        return !!this.callEvent.content[CALL_TERMINATED];
    }

    private createPeerCall(userId: string, deviceId: string): PeerCall {

    }
}

/**
 * Does WebRTC signalling for a single PeerConnection, and deals with WebRTC wrappers from platform
 * */


class LocalMedia {
    private tracks = new Map<TrackType, Track>();

    setTracks(tracks: Track[]) {
        for (const track of tracks) {
            this.setTrack(track);
        }
    }

    setTrack(track: Track) {
        let cameraAndMicStreamDontMatch = false;
        if (track.type === TrackType.Microphone) {
            const {cameraTrack} = this;
            if (cameraTrack && track.streamId !== cameraTrack.streamId) {
                cameraAndMicStreamDontMatch = true;
            }
        }
        if (track.type === TrackType.Camera) {
            const {microphoneTrack} = this;
            if (microphoneTrack && track.streamId !== microphoneTrack.streamId) {
                cameraAndMicStreamDontMatch = true;
            }
        }
        if (cameraAndMicStreamDontMatch) {
            throw new Error("The camera and audio track should have the same stream id");
        }
        this.tracks.set(track.type, track);
    }

    public get cameraTrack(): Track | undefined { return this.tracks.get(TrackType.Camera); };
    public get screenShareTrack(): Track | undefined { return this.tracks.get(TrackType.ScreenShare); };
    public get microphoneTrack(): AudioTrack | undefined { return this.tracks.get(TrackType.Microphone) as (AudioTrack | undefined); };

    getSDPMetadata(): any {
        const metadata = {};
        const userMediaTrack = this.microphoneTrack ?? this.cameraTrack;
        if (userMediaTrack) {
            metadata[userMediaTrack.streamId] = {
                purpose: StreamPurpose.UserMedia
            };
        }
        if (this.screenShareTrack) {
            metadata[this.screenShareTrack.streamId] = {
                purpose: StreamPurpose.ScreenShare
            };
        }
        return metadata;
    }
}

// when sending, we need to encrypt message with olm. I think the flow of room => roomEncryption => olmEncryption as we already
// do for sharing keys will be best as that already deals with room tracking.
type SendSignallingMessageCallback = (type: CallSetupMessageType, content: Record<string, any>) => Promise<void>;

/** Implements a call between two peers with the signalling state keeping, while still delegating the signalling message sending. Used by GroupCall.*/
class PeerCall implements PeerConnectionHandler {
    private readonly peerConnection: PeerConnection;

    constructor(
        private readonly sendSignallingMessage: SendSignallingMessageCallback,
        private localMedia: LocalMedia,
        webRTC: WebRTC
    ) {
        this.peerConnection = webRTC.createPeerConnection(this);
    }

    onIceConnectionStateChange(state: RTCIceConnectionState) {}
    onLocalIceCandidate(candidate: RTCIceCandidate) {}
    onIceGatheringStateChange(state: RTCIceGatheringState) {}
    onRemoteTracksChanged(tracks: Track[]) {}
    onDataChannelChanged(dataChannel: DataChannel | undefined) {}
    onNegotiationNeeded() {
        const message = {
            offer: this.peerConnection.createOffer(),
            sdp_stream_metadata: this.localMedia.getSDPMetadata(),
            version: 1
        }
        this.sendSignallingMessage(CallSetupMessageType.Invite, message);
    }

    setLocalMedia(localMedia: LocalMedia) {
        this.localMedia = localMedia;
        // TODO: send new metadata
    }


    // request the type of incoming track
    getPurposeForStreamId(streamId: string): StreamPurpose {
        // look up stream purpose 
        return StreamPurpose.UserMedia;
    }

    handleIncomingSignallingMessage(type: CallSetupMessageType, content: Record<string, any>) {
        switch (type) {
            case CallSetupMessageType.Invite:
            case CallSetupMessageType.Answer:
            case CallSetupMessageType.Candidates:
            case CallSetupMessageType.Hangup:
        }
    }
}

