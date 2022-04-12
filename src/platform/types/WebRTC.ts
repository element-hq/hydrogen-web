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

import {Track, Stream} from "./MediaDevices";
import {SDPStreamMetadataPurpose} from "../../matrix/calls/callEventTypes";

export interface WebRTC {
    createPeerConnection(handler: PeerConnectionHandler, forceTURN: boolean, turnServers: RTCIceServer[], iceCandidatePoolSize): PeerConnection;
}

export interface StreamSender {
    get stream(): Stream;
    get audioSender(): TrackSender | undefined;
    get videoSender(): TrackSender | undefined;
}

export interface StreamReceiver {
    get stream(): Stream;
    get audioReceiver(): TrackReceiver | undefined;
    get videoReceiver(): TrackReceiver | undefined;
}

export interface TrackReceiver {
    get track(): Track;
    get enabled(): boolean;
    enable(enabled: boolean); // this modifies the transceiver direction
}

export interface TrackSender extends TrackReceiver {
    /** replaces the track if possible without renegotiation. Can throw. */
    replaceTrack(track: Track): Promise<void>;
    /** make any needed adjustments to the sender or transceiver settings
     * depending on the purpose, after adding the track to the connection */
    prepareForPurpose(purpose: SDPStreamMetadataPurpose): void;
}

export interface PeerConnectionHandler {
    onIceConnectionStateChange(state: RTCIceConnectionState);
    onLocalIceCandidate(candidate: RTCIceCandidate);
    onIceGatheringStateChange(state: RTCIceGatheringState);
    onRemoteStreamRemoved(stream: Stream);
    onRemoteTracksAdded(receiver: TrackReceiver);
    onRemoteDataChannel(dataChannel: any | undefined);
    onNegotiationNeeded();
}

export interface PeerConnection {
    get iceGatheringState(): RTCIceGatheringState;
    get signalingState(): RTCSignalingState;
    get localDescription(): RTCSessionDescription | undefined;
    get localStreams(): ReadonlyArray<StreamSender>;
    get remoteStreams(): ReadonlyArray<StreamReceiver>;
    createOffer(): Promise<RTCSessionDescriptionInit>;
    createAnswer(): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    addTrack(track: Track): TrackSender | undefined;
    removeTrack(track: TrackSender): void;
    createDataChannel(options: RTCDataChannelInit): any;
    dispose(): void;
    close(): void;
}
