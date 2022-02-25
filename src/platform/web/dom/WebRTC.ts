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

import {TrackWrapper, wrapTrack} from "./MediaDevices";
import {Track, TrackType} from "../../types/MediaDevices";
import {WebRTC, PeerConnectionHandler, DataChannel, PeerConnection} from "../../types/WebRTC";
import {SDPStreamMetadataPurpose} from "../../../matrix/calls/callEventTypes";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

class DOMPeerConnection implements PeerConnection {
    private readonly peerConnection: RTCPeerConnection;
    private readonly handler: PeerConnectionHandler;
    //private dataChannelWrapper?: DOMDataChannel;
    private _remoteTracks: TrackWrapper[] = [];

    constructor(handler: PeerConnectionHandler, forceTURN: boolean, turnServers: RTCIceServer[], iceCandidatePoolSize = 0) {
        this.handler = handler;
        this.peerConnection = new RTCPeerConnection({
            iceTransportPolicy: forceTURN ? 'relay' : undefined,
            iceServers: turnServers,
            iceCandidatePoolSize: iceCandidatePoolSize,
        });
        this.registerHandler();
    }

    get remoteTracks(): Track[] { return this._remoteTracks; }
    get dataChannel(): DataChannel | undefined { return undefined; }
    get iceGatheringState(): RTCIceGatheringState { return this.peerConnection.iceGatheringState; }
    get localDescription(): RTCSessionDescription | undefined { return this.peerConnection.localDescription ?? undefined; }

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

    addTrack(track: Track): void {
        if (!(track instanceof TrackWrapper)) {
            throw new Error("Not a TrackWrapper");
        }
        this.peerConnection.addTrack(track.track, track.stream);
        if (track.type === TrackType.ScreenShare) {
            this.getRidOfRTXCodecs(track);
        }
    }

    removeTrack(track: Track): boolean {
        if (!(track instanceof TrackWrapper)) {
            throw new Error("Not a TrackWrapper");
        }
        const sender = this.peerConnection.getSenders().find(s => s.track === track.track);
        if (sender) {
            this.peerConnection.removeTrack(sender);
            return true;
        }
        return false;
    }
    
    async replaceTrack(oldTrack: Track, newTrack: Track): Promise<boolean> {
        if (!(oldTrack instanceof TrackWrapper) || !(newTrack instanceof TrackWrapper)) {
            throw new Error("Not a TrackWrapper");
        }
        const sender = this.peerConnection.getSenders().find(s => s.track === oldTrack.track);
        if (sender) {
            await sender.replaceTrack(newTrack.track);
            if (newTrack.type === TrackType.ScreenShare) {
                this.getRidOfRTXCodecs(newTrack);
            }
            return true;
        }
        return false;
    }

    notifyStreamPurposeChanged(): void {
        for (const track of this.remoteTracks) {
            const wrapper = track as TrackWrapper;
            wrapper.setType(this.getRemoteTrackType(wrapper.track, wrapper.streamId));
        }
    }

    createDataChannel(): DataChannel {
        return new DataChannel(this.peerConnection.createDataChannel());
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
                break;
        }
    }

    dispose(): void {
        this.deregisterHandler();
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

    private handleRemoteTrack(evt: RTCTrackEvent) {
        // the tracks on the new stream (with their stream)
        const updatedTracks = evt.streams.flatMap(stream => stream.getTracks().map(track => {return {stream, track};}));
        // of the tracks we already know about, filter the ones that aren't in the new stream
        const withoutRemovedTracks = this._remoteTracks.filter(t => !updatedTracks.some(ut => t.track.id === ut.track.id));
        // of the new tracks, filter the ones that we didn't already knew about
        const addedTracks = updatedTracks.filter(ut => !this._remoteTracks.some(t => t.track.id === ut.track.id));
        // wrap them
        const wrappedAddedTracks = addedTracks.map(t => wrapTrack(t.track, t.stream, this.getRemoteTrackType(t.track, t.stream.id)));
        // and concat the tracks for other streams with the added tracks
        this._remoteTracks = withoutRemovedTracks.concat(...wrappedAddedTracks);
        this.handler.onRemoteTracksChanged(this.remoteTracks);
    }

    private getRemoteTrackType(track: MediaStreamTrack, streamId: string): TrackType {
        if (track.kind === "video") {
            const purpose = this.handler.getPurposeForStreamId(streamId);
            return purpose === SDPStreamMetadataPurpose.Usermedia ? TrackType.Camera : TrackType.ScreenShare;
        } else {
            return TrackType.Microphone;
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
    private getRidOfRTXCodecs(screensharingTrack: TrackWrapper): void {
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

        for (const trans of this.peerConnection.getTransceivers()) {
            if (trans.sender.track === screensharingTrack.track &&
                (
                    trans.sender.track?.kind === "video" ||
                    trans.receiver.track?.kind === "video"
                )
            ) {
                trans.setCodecPreferences(codecs);
            }
        }
    }
}
