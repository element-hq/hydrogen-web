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

import {Track, Stream, Event} from "./MediaDevices";
import {SDPStreamMetadataPurpose} from "../../matrix/calls/callEventTypes";

export interface WebRTC {
    createPeerConnection(forceTURN: boolean, turnServers: RTCIceServer[], iceCandidatePoolSize: number): PeerConnection;
    prepareSenderForPurpose(peerConnection: PeerConnection, sender: Sender, purpose: SDPStreamMetadataPurpose): void;
}

// Typescript definitions derived from https://github.com/microsoft/TypeScript/blob/main/lib/lib.dom.d.ts
/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0
THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.
See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

export interface DataChannelEventMap {
    "bufferedamountlow": Event;
    "close": Event;
    "error": Event;
    "message": MessageEvent;
    "open": Event;
}

export interface DataChannel {
    binaryType: BinaryType;
    readonly id: number | null;
    readonly label: string;
    readonly negotiated: boolean;
    readonly readyState: DataChannelState;
    close(): void;
    send(data: string): void;
    send(data: Blob): void;
    send(data: ArrayBuffer): void;
    send(data: ArrayBufferView): void;
    addEventListener<K extends keyof DataChannelEventMap>(type: K, listener: (this: DataChannel, ev: DataChannelEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof DataChannelEventMap>(type: K, listener: (this: DataChannel, ev: DataChannelEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
}

export interface DataChannelInit {
    id?: number;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
    negotiated?: boolean;
    ordered?: boolean;
    protocol?: string;
}

export interface DataChannelEvent extends Event {
    readonly channel: DataChannel;
}

export interface PeerConnectionIceEvent extends Event {
    readonly candidate: RTCIceCandidate | null;
}

export interface TrackEvent extends Event {
    readonly receiver: Receiver;
    readonly streams: ReadonlyArray<Stream>;
    readonly track: Track;
    readonly transceiver: Transceiver;
}

export interface PeerConnectionEventMap {
    "connectionstatechange": Event;
    "datachannel": DataChannelEvent;
    "icecandidate": PeerConnectionIceEvent;
    "iceconnectionstatechange": Event;
    "icegatheringstatechange": Event;
    "negotiationneeded": Event;
    "signalingstatechange": Event;
    "track": TrackEvent;
}

export type DataChannelState = "closed" | "closing" | "connecting" | "open";
export type IceConnectionState = "checking" | "closed" | "completed" | "connected" | "disconnected" | "failed" | "new";
export type PeerConnectionState = "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new";
export type SignalingState = "closed" | "have-local-offer" | "have-local-pranswer" | "have-remote-offer" | "have-remote-pranswer" | "stable";
export type IceGatheringState = "complete" | "gathering" | "new";
export type SdpType = "answer" | "offer" | "pranswer" | "rollback";
export type TransceiverDirection = "inactive" | "recvonly" | "sendonly" | "sendrecv" | "stopped";
export interface SessionDescription {
    readonly sdp: string;
    readonly type: SdpType;
}

export interface AnswerOptions {}

export interface OfferOptions {
    iceRestart?: boolean;
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
}

export interface SessionDescriptionInit {
    sdp?: string;
    type: SdpType;
}

export interface LocalSessionDescriptionInit {
    sdp?: string;
    type?: SdpType;
}

/** A WebRTC connection between the local computer and a remote peer. It provides methods to connect to a remote peer, maintain and monitor the connection, and close the connection once it's no longer needed. */
export interface PeerConnection {
    readonly connectionState: PeerConnectionState;
    readonly iceConnectionState: IceConnectionState;
    readonly iceGatheringState: IceGatheringState;
    readonly localDescription: SessionDescription | null;
    readonly remoteDescription: SessionDescription | null;
    readonly signalingState: SignalingState;
    addIceCandidate(candidate?: RTCIceCandidateInit): Promise<void>;
    addTrack(track: Track, ...streams: Stream[]): Sender;
    close(): void;
    createAnswer(options?: AnswerOptions): Promise<SessionDescriptionInit>;
    createDataChannel(label: string, dataChannelDict?: DataChannelInit): DataChannel;
    createOffer(options?: OfferOptions): Promise<SessionDescriptionInit>;
    getReceivers(): Receiver[];
    getSenders(): Sender[];
    getTransceivers(): Transceiver[];
    removeTrack(sender: Sender): void;
    restartIce(): void;
    setLocalDescription(description?: LocalSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: SessionDescriptionInit): Promise<void>;
    addEventListener<K extends keyof PeerConnectionEventMap>(type: K, listener: (this: PeerConnection, ev: PeerConnectionEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof PeerConnectionEventMap>(type: K, listener: (this: PeerConnection, ev: PeerConnectionEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    getStats(selector?: Track | null): Promise<StatsReport>;
    setConfiguration(configuration?: RTCConfiguration): void;
}



interface StatsReport {
    forEach(callbackfn: (value: any, key: string, parent: StatsReport) => void, thisArg?: any): void;
}

export interface Receiver {
    readonly track: Track;
}

export interface Sender {
    readonly track: Track | null;
    replaceTrack(withTrack: Track | null): Promise<void>;
}

export interface Transceiver {
    readonly currentDirection: TransceiverDirection | null;
    direction: TransceiverDirection;
    readonly mid: string | null;
    readonly receiver: Receiver;
    readonly sender: Sender;
    stop(): void;
}
