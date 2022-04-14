/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import {StreamWrapper, TrackWrapper, AudioTrackWrapper} from "./MediaDevices";
import {Stream, Track, AudioTrack, TrackKind} from "../../types/MediaDevices";
import {WebRTC, PeerConnectionHandler, StreamSender, TrackSender, StreamReceiver, TrackReceiver, PeerConnection} from "../../types/WebRTC";
import {SDPStreamMetadataPurpose} from "../../../matrix/calls/callEventTypes";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

export class DOMWebRTC implements WebRTC {
    createPeerConnection(handler: PeerConnectionHandler, forceTURN: boolean, turnServers: RTCIceServer[], iceCandidatePoolSize): PeerConnection {
        return new DOMPeerConnection(handler, forceTURN, turnServers, iceCandidatePoolSize);
    }
}

export class RemoteStreamWrapper extends StreamWrapper {
    constructor(stream: MediaStream, private readonly emptyCallback: (stream: RemoteStreamWrapper) => void) {
        super(stream);
        this.stream.addEventListener("removetrack", this.onTrackRemoved);
    }

    onTrackRemoved = (evt: MediaStreamTrackEvent) => {
        if (evt.track.id === this.audioTrack?.track.id) {
            this.audioTrack = undefined;
        } else if (evt.track.id === this.videoTrack?.track.id) {
            this.videoTrack = undefined;
        }
        if (!this.audioTrack && !this.videoTrack) {
            this.emptyCallback(this);
        }
    };

    dispose() {
        this.stream.removeEventListener("removetrack", this.onTrackRemoved);
    }
}

export class DOMStreamSender implements StreamSender {
    public audioSender: DOMTrackSender | undefined;
    public videoSender: DOMTrackSender | undefined;
    
    constructor(public readonly stream: StreamWrapper) {}

    update(transceivers: ReadonlyArray<RTCRtpTransceiver>, sender: RTCRtpSender): DOMTrackSender | undefined {
        const transceiver = transceivers.find(t => t.sender === sender);
        if (transceiver && sender.track) {
            const trackWrapper = this.stream.update(sender.track);
            if (trackWrapper) {
                if (trackWrapper.kind === TrackKind.Video && (!this.videoSender || this.videoSender.track.id !== trackWrapper.id)) {
                    this.videoSender = new DOMTrackSender(trackWrapper, transceiver);
                    return this.videoSender;
                } else if (trackWrapper.kind === TrackKind.Audio && (!this.audioSender || this.audioSender.track.id !== trackWrapper.id)) {
                    this.audioSender = new DOMTrackSender(trackWrapper, transceiver);
                    return this.audioSender;
                }
            }
        }
    }
}

export class DOMStreamReceiver implements StreamReceiver {
    public audioReceiver: DOMTrackReceiver | undefined;
    public videoReceiver: DOMTrackReceiver | undefined;
    
    constructor(public readonly stream: RemoteStreamWrapper) {}

    update(event: RTCTrackEvent): DOMTrackReceiver | undefined {
        const {receiver} = event;
        const {track} = receiver;
        const trackWrapper = this.stream.update(track);
        if (trackWrapper) {
            if (trackWrapper.kind === TrackKind.Video) {
                this.videoReceiver = new DOMTrackReceiver(trackWrapper, event.transceiver);
                return this.videoReceiver;
            } else {
                this.audioReceiver = new DOMTrackReceiver(trackWrapper, event.transceiver);
                return this.audioReceiver;
            }
        }
    }
}

export class DOMTrackSenderOrReceiver implements TrackReceiver {
    constructor(
        public readonly track: TrackWrapper,
        public readonly transceiver: RTCRtpTransceiver,
        private readonly exclusiveValue: RTCRtpTransceiverDirection,
        private readonly excludedValue: RTCRtpTransceiverDirection
    ) {}

    get enabled(): boolean {
        return this.transceiver.direction === "sendrecv" ||
            this.transceiver.direction === this.exclusiveValue;
    }

    enableWithoutRenegotiation(enabled: boolean) {
        this.track.track.enabled = enabled;
    }

    enable(enabled: boolean) {
        if (enabled !== this.enabled) {
            // do this first, so we stop sending track data immediately.
            // this will still consume bandwidth though, so also disable the transceiver,
            // which will trigger a renegotiation though.
            this.enableWithoutRenegotiation(enabled);
            if (enabled) {
                if (this.transceiver.direction === "inactive") {
                    this.transceiver.direction = this.exclusiveValue;
                } else {
                    this.transceiver.direction = "sendrecv";
                }
            } else {
                if (this.transceiver.direction === "sendrecv") {
                    this.transceiver.direction = this.excludedValue;
                } else {
                    this.transceiver.direction = "inactive";
                }
            }
        }
    }
}

export class DOMTrackReceiver extends DOMTrackSenderOrReceiver {
    constructor(
        track: TrackWrapper,
        transceiver: RTCRtpTransceiver,
    ) {
        super(track, transceiver, "recvonly", "sendonly");
    }
}

export class DOMTrackSender extends DOMTrackSenderOrReceiver {
    constructor(
        track: TrackWrapper,
        transceiver: RTCRtpTransceiver,
    ) {
        super(track, transceiver, "sendonly", "recvonly");
    }
    /** replaces the track if possible without renegotiation. Can throw. */
    replaceTrack(track: Track | undefined): Promise<void> {
        return this.transceiver.sender.replaceTrack(track ? (track as TrackWrapper).track : null);
    }

    prepareForPurpose(purpose: SDPStreamMetadataPurpose): void {
        if (purpose === SDPStreamMetadataPurpose.Screenshare) {
            this.getRidOfRTXCodecs();
        }
    }

    /**
     * This method removes all video/rtx codecs from screensharing video
     * transceivers. This is necessary since they can cause problems. Without
     * this the following steps should produce an error:
     *   Chromium calls Firefox
     *   Firefox answers
     *   Firefox starts screen-sharing
     *   Chromium starts screen-sharing
     *   Call crashes for Chromium with:
     *       [96685:23:0518/162603.933321:ERROR:webrtc_video_engine.cc(3296)] RTX codec (PT=97) mapped to PT=96 which is not in the codec list.
     *       [96685:23:0518/162603.933377:ERROR:webrtc_video_engine.cc(1171)] GetChangedRecvParameters called without any video codecs.
     *       [96685:23:0518/162603.933430:ERROR:sdp_offer_answer.cc(4302)] Failed to set local video description recv parameters for m-section with mid='2'. (INVALID_PARAMETER)
     */
    private getRidOfRTXCodecs(): void {
        // RTCRtpReceiver.getCapabilities and RTCRtpSender.getCapabilities don't seem to be supported on FF
        if (!RTCRtpReceiver.getCapabilities || !RTCRtpSender.getCapabilities) return;

        const recvCodecs = RTCRtpReceiver.getCapabilities("video")?.codecs ?? [];
        const sendCodecs = RTCRtpSender.getCapabilities("video")?.codecs ?? [];
        const codecs = [...sendCodecs, ...recvCodecs];

        for (const codec of codecs) {
            if (codec.mimeType === "video/rtx") {
                const rtxCodecIndex = codecs.indexOf(codec);
                codecs.splice(rtxCodecIndex, 1);
            }
        }
        if (this.transceiver.sender.track?.kind === "video" ||
            this.transceiver.receiver.track?.kind === "video") {
            this.transceiver.setCodecPreferences(codecs);
        }
    }
}

class DOMPeerConnection implements PeerConnection {
    private readonly peerConnection: RTCPeerConnection;
    private readonly handler: PeerConnectionHandler;
    public readonly localStreams: Map<string, DOMStreamSender> = new Map();
    public readonly remoteStreams: Map<string, DOMStreamReceiver> = new Map();

    constructor(handler: PeerConnectionHandler, forceTURN: boolean, turnServers: RTCIceServer[], iceCandidatePoolSize) {
        this.handler = handler;
        this.peerConnection = new RTCPeerConnection({
            iceTransportPolicy: forceTURN ? 'relay' : undefined,
            iceServers: turnServers,
            iceCandidatePoolSize: iceCandidatePoolSize,
        });
        this.registerHandler();
    }

    get iceGatheringState(): RTCIceGatheringState { return this.peerConnection.iceGatheringState; }
    get localDescription(): RTCSessionDescription | undefined { return this.peerConnection.localDescription ?? undefined; }
    get signalingState(): RTCSignalingState { return this.peerConnection.signalingState; }

    createOffer(): Promise<RTCSessionDescriptionInit> {
        return this.peerConnection.createOffer();
    }

    createAnswer(): Promise<RTCSessionDescriptionInit> {
        return this.peerConnection.createAnswer();
    }

    setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void> {
        return this.peerConnection.setLocalDescription(description);
    }

    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
        return this.peerConnection.setRemoteDescription(description);
    }

    addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
        return this.peerConnection.addIceCandidate(candidate);
    }

    close(): void {
        return this.peerConnection.close();
    }

    addTrack(track: Track): DOMTrackSender | undefined {
        if (!(track instanceof TrackWrapper)) {
            throw new Error("Not a TrackWrapper");
        }
        const sender = this.peerConnection.addTrack(track.track, track.stream);
        let streamSender = this.localStreams.get(track.stream.id);
        if (!streamSender) {
            // TODO: reuse existing stream wrapper here?
            streamSender = new DOMStreamSender(new StreamWrapper(track.stream));
            this.localStreams.set(track.stream.id, streamSender);
        }
        const trackSender = streamSender.update(this.peerConnection.getTransceivers(), sender);
        return trackSender;
    }

    removeTrack(sender: TrackSender): void {
        if (!(sender instanceof DOMTrackSender)) {
            throw new Error("Not a DOMTrackSender");
        }
        this.peerConnection.removeTrack((sender as DOMTrackSender).transceiver.sender);
        // TODO: update localStreams
    }

    createDataChannel(options: RTCDataChannelInit): any {
        return this.peerConnection.createDataChannel("channel", options);
    }

    private registerHandler() {
        const pc = this.peerConnection;
        pc.addEventListener('negotiationneeded', this);
        pc.addEventListener('icecandidate', this);
        pc.addEventListener('iceconnectionstatechange', this);
        pc.addEventListener('icegatheringstatechange', this);
        pc.addEventListener('signalingstatechange', this);
        pc.addEventListener('track', this);
        pc.addEventListener('datachannel', this);
    }

    private deregisterHandler() {
        const pc = this.peerConnection;
        pc.removeEventListener('negotiationneeded', this);
        pc.removeEventListener('icecandidate', this);
        pc.removeEventListener('iceconnectionstatechange', this);
        pc.removeEventListener('icegatheringstatechange', this);
        pc.removeEventListener('signalingstatechange', this);
        pc.removeEventListener('track', this);
        pc.removeEventListener('datachannel', this);
    }

    /** @internal */
    handleEvent(evt: Event) {
        switch (evt.type) {
            case "iceconnectionstatechange":
                this.handleIceConnectionStateChange();
                break;
            case "icecandidate":
                this.handleLocalIceCandidate(evt as RTCPeerConnectionIceEvent);
                break;
            case "icegatheringstatechange":
                this.handler.onIceGatheringStateChange(this.peerConnection.iceGatheringState);
                break;
            case "track":
                this.handleRemoteTrack(evt as RTCTrackEvent);
                break;
            case "negotiationneeded":
                this.handler.onNegotiationNeeded();
                break;
            case "datachannel":
                this.handler.onRemoteDataChannel((evt as RTCDataChannelEvent).channel);
                break;
        }
    }

    dispose(): void {
        this.deregisterHandler();
        for (const r of this.remoteStreams.values()) {
            r.stream.dispose();
        }
    }

    private handleLocalIceCandidate(event: RTCPeerConnectionIceEvent) {
        if (event.candidate) {
            this.handler.onLocalIceCandidate(event.candidate);
        }
    };

    private handleIceConnectionStateChange() {
        const {iceConnectionState} = this.peerConnection;
        if (iceConnectionState === "failed" && this.peerConnection.restartIce) {
            this.peerConnection.restartIce();
        } else {
            this.handler.onIceConnectionStateChange(iceConnectionState);
        }
    }

    onRemoteStreamEmpty = (stream: RemoteStreamWrapper): void => {
        if (this.remoteStreams.delete(stream.id)) {
            this.handler.onRemoteStreamRemoved(stream);
        }
    }

    private handleRemoteTrack(evt: RTCTrackEvent) {
        if (evt.streams.length !== 1) {
            throw new Error("track in multiple streams is not supported");
        }
        const stream = evt.streams[0];
        const transceivers = this.peerConnection.getTransceivers();
        let streamReceiver: DOMStreamReceiver | undefined = this.remoteStreams.get(stream.id);
        if (!streamReceiver) {
            streamReceiver = new DOMStreamReceiver(new RemoteStreamWrapper(stream, this.onRemoteStreamEmpty));
            this.remoteStreams.set(stream.id, streamReceiver);
        }
        const trackReceiver = streamReceiver.update(evt);
        if (trackReceiver) {
            this.handler.onRemoteTracksAdded(trackReceiver);
        }
    }
}
