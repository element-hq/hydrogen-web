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
import {WebRTC, PeerConnectionHandler, DataChannel, PeerConnection, StreamPurpose} from "../../types/WebRTC";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

class DOMPeerConnection implements PeerConnection {
    private readonly peerConnection: RTCPeerConnection;
    private readonly handler: PeerConnectionHandler;
    private dataChannelWrapper?: DOMDataChannel;
    private _remoteTracks: TrackWrapper[];

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
    get dataChannel(): DataChannel | undefined { return this.dataChannelWrapper; }

    createOffer(): Promise<RTCSessionDescriptionInit> {
        return this.peerConnection.createOffer();
    }

    createAnswer(): Promise<RTCSessionDescriptionInit> {
        return this.peerConnection.createAnswer();
    }

    setLocalDescription(description: RTCSessionDescriptionInit) {
        this.peerConnection.setLocalDescription(description);
    }

    setRemoteDescription(description: RTCSessionDescriptionInit) {
        this.peerConnection.setRemoteDescription(description);
    }

    addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
        return this.peerConnection.addIceCandidate(candidate);
    }

    addTrack(track: Track): void {
        if (!(track instanceof TrackWrapper)) {
            throw new Error("Not a TrackWrapper");
        }
        this.peerConnection.addTrack(track.track, track.stream);
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
            return true;
        }
        return false;
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
        const updatedTracks = evt.streams.flatMap(stream => stream.getTracks().map(track => {return {stream, track};}));
        const withoutRemovedTracks = this._remoteTracks.filter(t => !updatedTracks.some(ut => t.track == ut.track));
        const addedTracks = updatedTracks.filter(ut => !this._remoteTracks.some(t => t.track === ut.track));
        const wrappedAddedTracks = addedTracks.map(t => this.wrapRemoteTrack(t.track, t.stream));
        this._remoteTracks = withoutRemovedTracks.concat(...wrappedAddedTracks);
        this.handler.onRemoteTracksChanged(this.remoteTracks);
    }
    private wrapRemoteTrack(track: MediaStreamTrack, stream: MediaStream): TrackWrapper {
        let type: TrackType;
        if (track.kind === "video") {
            const purpose = this.handler.getPurposeForStreamId(stream.id);
            type = purpose === StreamPurpose.UserMedia ? TrackType.Camera : TrackType.ScreenShare;
        } else {
            type = TrackType.Microphone;
        }
        return wrapTrack(track, stream, type);
    }
}
