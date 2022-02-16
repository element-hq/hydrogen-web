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
import {Track} from "../../types/MediaDevices";
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
            type = purpose === StreamPurpose.Usermedia ? TrackType.Camera : TrackType.ScreenShare;
        } else {
            type = TrackType.Microphone;
        }
        return wrapTrack(track, stream, type);
    }
}

export interface ICallFeedOpts {
    client: MatrixClient;
    roomId: string;
    userId: string;
    stream: MediaStream;
    purpose: SDPStreamMetadataPurpose;
    audioMuted: boolean;
    videoMuted: boolean;
}

export enum CallFeedEvent {
    NewStream = "new_stream",
    MuteStateChanged = "mute_state_changed",
    VolumeChanged = "volume_changed",
    Speaking = "speaking",
}

export class CallFeed extends EventEmitter {
    public stream: MediaStream;
    public sdpMetadataStreamId: string;
    public userId: string;
    public purpose: SDPStreamMetadataPurpose;
    public speakingVolumeSamples: number[];

    private client: MatrixClient;
    private roomId: string;
    private audioMuted: boolean;
    private videoMuted: boolean;
    private measuringVolumeActivity = false;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private frequencyBinCount: Float32Array;
    private speakingThreshold = SPEAKING_THRESHOLD;
    private speaking = false;
    private volumeLooperTimeout: number;

    constructor(opts: ICallFeedOpts) {
        super();

        this.client = opts.client;
        this.roomId = opts.roomId;
        this.userId = opts.userId;
        this.purpose = opts.purpose;
        this.audioMuted = opts.audioMuted;
        this.videoMuted = opts.videoMuted;
        this.speakingVolumeSamples = new Array(SPEAKING_SAMPLE_COUNT).fill(-Infinity);
        this.sdpMetadataStreamId = opts.stream.id;

        this.updateStream(null, opts.stream);

        if (this.hasAudioTrack) {
            this.initVolumeMeasuring();
        }
    }

    private get hasAudioTrack(): boolean {
        return this.stream.getAudioTracks().length > 0;
    }

    private updateStream(oldStream: MediaStream, newStream: MediaStream): void {
        if (newStream === oldStream) return;

        if (oldStream) {
            oldStream.removeEventListener("addtrack", this.onAddTrack);
            this.measureVolumeActivity(false);
        }
        if (newStream) {
            this.stream = newStream;
            newStream.addEventListener("addtrack", this.onAddTrack);

            if (this.hasAudioTrack) {
                this.initVolumeMeasuring();
            } else {
                this.measureVolumeActivity(false);
            }
        }

        this.emit(CallFeedEvent.NewStream, this.stream);
    }

    private initVolumeMeasuring(): void {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!this.hasAudioTrack || !AudioContext) return;

        this.audioContext = new AudioContext();

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.1;

        const mediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(this.stream);
        mediaStreamAudioSourceNode.connect(this.analyser);

        this.frequencyBinCount = new Float32Array(this.analyser.frequencyBinCount);
    }

    private onAddTrack = (): void => {
        this.emit(CallFeedEvent.NewStream, this.stream);
    };

    /**
     * Returns callRoom member
     * @returns member of the callRoom
     */
    public getMember(): RoomMember {
        const callRoom = this.client.getRoom(this.roomId);
        return callRoom.getMember(this.userId);
    }

    /**
     * Returns true if CallFeed is local, otherwise returns false
     * @returns {boolean} is local?
     */
    public isLocal(): boolean {
        return this.userId === this.client.getUserId();
    }

    /**
     * Returns true if audio is muted or if there are no audio
     * tracks, otherwise returns false
     * @returns {boolean} is audio muted?
     */
    public isAudioMuted(): boolean {
        return this.stream.getAudioTracks().length === 0 || this.audioMuted;
    }

    /**
     * Returns true video is muted or if there are no video
     * tracks, otherwise returns false
     * @returns {boolean} is video muted?
     */
    public isVideoMuted(): boolean {
        // We assume only one video track
        return this.stream.getVideoTracks().length === 0 || this.videoMuted;
    }

    public isSpeaking(): boolean {
        return this.speaking;
    }

    /**
     * Replaces the current MediaStream with a new one.
     * This method should be only used by MatrixCall.
     * @param newStream new stream with which to replace the current one
     */
    public setNewStream(newStream: MediaStream): void {
        this.updateStream(this.stream, newStream);
    }

    /**
     * Set feed's internal audio mute state
     * @param muted is the feed's audio muted?
     */
    public setAudioMuted(muted: boolean): void {
        this.audioMuted = muted;
        this.speakingVolumeSamples.fill(-Infinity);
        this.emit(CallFeedEvent.MuteStateChanged, this.audioMuted, this.videoMuted);
    }

    /**
     * Set feed's internal video mute state
     * @param muted is the feed's video muted?
     */
    public setVideoMuted(muted: boolean): void {
        this.videoMuted = muted;
        this.emit(CallFeedEvent.MuteStateChanged, this.audioMuted, this.videoMuted);
    }

    /**
     * Starts emitting volume_changed events where the emitter value is in decibels
     * @param enabled emit volume changes
     */
    public measureVolumeActivity(enabled: boolean): void {
        if (enabled) {
            if (!this.audioContext || !this.analyser || !this.frequencyBinCount || !this.hasAudioTrack) return;

            this.measuringVolumeActivity = true;
            this.volumeLooper();
        } else {
            this.measuringVolumeActivity = false;
            this.speakingVolumeSamples.fill(-Infinity);
            this.emit(CallFeedEvent.VolumeChanged, -Infinity);
        }
    }

    public setSpeakingThreshold(threshold: number) {
        this.speakingThreshold = threshold;
    }

    private volumeLooper = () => {
        if (!this.analyser) return;

        if (!this.measuringVolumeActivity) return;

        this.analyser.getFloatFrequencyData(this.frequencyBinCount);

        let maxVolume = -Infinity;
        for (let i = 0; i < this.frequencyBinCount.length; i++) {
            if (this.frequencyBinCount[i] > maxVolume) {
                maxVolume = this.frequencyBinCount[i];
            }
        }

        this.speakingVolumeSamples.shift();
        this.speakingVolumeSamples.push(maxVolume);

        this.emit(CallFeedEvent.VolumeChanged, maxVolume);

        let newSpeaking = false;

        for (let i = 0; i < this.speakingVolumeSamples.length; i++) {
            const volume = this.speakingVolumeSamples[i];

            if (volume > this.speakingThreshold) {
                newSpeaking = true;
                break;
            }
        }

        if (this.speaking !== newSpeaking) {
            this.speaking = newSpeaking;
            this.emit(CallFeedEvent.Speaking, this.speaking);
        }

        this.volumeLooperTimeout = setTimeout(this.volumeLooper, POLLING_INTERVAL);
    };

    public clone(): CallFeed {
        const mediaHandler = this.client.getMediaHandler();
        const stream = this.stream.clone();

        if (this.purpose === SDPStreamMetadataPurpose.Usermedia) {
            mediaHandler.userMediaStreams.push(stream);
        } else {
            mediaHandler.screensharingStreams.push(stream);
        }

        return new CallFeed({
            client: this.client,
            roomId: this.roomId,
            userId: this.userId,
            stream,
            purpose: this.purpose,
            audioMuted: this.audioMuted,
            videoMuted: this.videoMuted,
        });
    }

    public dispose(): void {
        clearTimeout(this.volumeLooperTimeout);
    }
}
