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
import {recursivelyAssign} from "../../utils/recursivelyAssign";
import {AsyncQueue} from "../../utils/AsyncQueue";
import type {Room} from "../room/Room";
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";

import {WebRTC, PeerConnection, PeerConnectionHandler, StreamPurpose} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";
import type {LocalMedia} from "./LocalMedia";

// when sending, we need to encrypt message with olm. I think the flow of room => roomEncryption => olmEncryption as we already
// do for sharing keys will be best as that already deals with room tracking.
/**
 * Does WebRTC signalling for a single PeerConnection, and deals with WebRTC wrappers from platform
 * */
/** Implements a call between two peers with the signalling state keeping, while still delegating the signalling message sending. Used by GroupCall.*/
class PeerCall {
    private readonly peerConnection: PeerConnection;
    private state = CallState.Fledgling;
    private direction: CallDirection;
    // A queue for candidates waiting to go out.
    // We try to amalgamate candidates into a single candidate message where
    // possible
    private candidateSendQueue: Array<RTCIceCandidate> = [];
    // If candidates arrive before we've picked an opponent (which, in particular,
    // will happen if the opponent sends candidates eagerly before the user answers
    // the call) we buffer them up here so we can then add the ones from the party we pick
    private remoteCandidateBuffer? = new Map<string, RTCIceCandidate[]>();

    private logger: any;
    private remoteSDPStreamMetadata?: SDPStreamMetadata;
    private responsePromiseChain?: Promise<void>;
    private opponentPartyId?: PartyId;

    constructor(
        private readonly handler: PeerCallHandler,
        private localMedia: LocalMedia,
        webRTC: WebRTC
    ) {
        const outer = this;
        this.peerConnection = webRTC.createPeerConnection({
            onIceConnectionStateChange(state: RTCIceConnectionState) {},
            onLocalIceCandidate(candidate: RTCIceCandidate) {},
            onIceGatheringStateChange(state: RTCIceGatheringState) {},
            onRemoteTracksChanged(tracks: Track[]) {},
            onDataChannelChanged(dataChannel: DataChannel | undefined) {},
            onNegotiationNeeded() {
                const promiseCreator = () => outer.handleNegotiation();
                outer.responsePromiseChain = outer.responsePromiseChain?.then(promiseCreator) ?? promiseCreator();
            },
            getPurposeForStreamId(streamId: string): SDPStreamMetadataPurpose {
                return outer.remoteSDPStreamMetadata?.[streamId]?.purpose ?? SDPStreamMetadataPurpose.Usermedia;
            }
        });
        this.logger = {
            debug(...args) { console.log.apply(console, ["WebRTC debug:", ...args])},
            log(...args) { console.log.apply(console, ["WebRTC log:", ...args])},
            warn(...args) { console.log.apply(console, ["WebRTC warn:", ...args])},
            error(...args) { console.error.apply(console, ["WebRTC error:", ...args])},
        }
    }

    handleIncomingSignallingMessage(message: SignallingMessage, partyId: PartyId) {
        switch (message.type) {
            case EventType.Invite:
                this.handleInvite(message.content);
                break;
            case EventType.Answer:
                this.handleAnswer(message.content);
                break;
            case EventType.Candidates:
                this.handleRemoteIceCandidates(message.content);
                break;
            case EventType.Hangup:
        }
    }

    async call(localMediaPromise: Promise<LocalMedia>): Promise<void> {
        if (this.state !== CallState.Fledgling) {
            return;
        }
        this.direction = CallDirection.Outbound;
        this.setState(CallState.WaitLocalMedia);
        try {
            this.localMedia = await localMediaPromise;
        } catch (err) {
            this.setState(CallState.Ended);
            return;
        }
        this.setState(CallState.CreateOffer);
        // add the local tracks, and wait for onNegotiationNeeded and handleNegotiation to be called
        for (const t of this.localMedia.tracks) {
            this.peerConnection.addTrack(t);
        }
        await this.waitForState(CallState.InviteSent);
    }

    async answer() {

    }

    async hangup() {

    }

    async updateLocalMedia(localMediaPromise: Promise<LocalMedia>) {
        const oldMedia = this.localMedia;
        this.localMedia = await localMediaPromise;

        const applyTrack = (selectTrack: (media: LocalMedia) => Track | undefined) => {
            const oldTrack = selectTrack(oldMedia);
            const newTrack = selectTrack(this.localMedia);
            if (oldTrack && newTrack) {
                this.peerConnection.replaceTrack(oldTrack, newTrack);
            } else if (oldTrack) {
                this.peerConnection.removeTrack(oldTrack);
            } else if (newTrack) {
                this.peerConnection.addTrack(newTrack);
            }
        };

        // add the local tracks, and wait for onNegotiationNeeded and handleNegotiation to be called
        applyTrack(m => m.microphoneTrack);
        applyTrack(m => m.cameraTrack);
        applyTrack(m => m.screenShareTrack);
    }

    // calls are serialized and deduplicated by negotiationQueue
    private handleNegotiation = async (): Promise<void> => {
        try {
            await this.peerConnection.setLocalDescription();
        } catch (err) {
            this.logger.debug(`Call ${this.callId} Error setting local description!`, err);
            this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, true);
            return;
        }

        if (this.peerConnection.iceGatheringState === 'gathering') {
            // Allow a short time for initial candidates to be gathered
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (this.state === CallState.Ended) {
            return;
        }

        const offer = this.peerConnection.localDescription!;
        // Get rid of any candidates waiting to be sent: they'll be included in the local
        // description we just got and will send in the offer.
        this.logger.info(`Call ${this.callId} Discarding ${
            this.candidateSendQueue.length} candidates that will be sent in offer`);
        this.candidateSendQueue = [];

        // need to queue this
        const content = {
            offer,
            [SDPStreamMetadataKey]: this.localMedia.getSDPMetadata(),
            version: 1,
            lifetime: CALL_TIMEOUT_MS
        };
        if (this.state === CallState.CreateOffer) {
            await this.handler.sendSignallingMessage({type: EventType.Invite, content});
            this.setState(CallState.InviteSent);
        }
    };

    private async handleInvite(content: InviteContent, partyId: PartyId): Promise<void> {
        if (this.state !== CallState.Fledgling || this.opponentPartyId !== undefined) {
            // TODO: hangup or ignore?
            return;
        }

        // we must set the party ID before await-ing on anything: the call event
        // handler will start giving us more call events (eg. candidates) so if
        // we haven't set the party ID, we'll ignore them.
        this.opponentPartyId = partyId;
        this.direction = CallDirection.Inbound;

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
        } else {
            this.logger.debug(`Call ${
                this.callId} did not get any SDPStreamMetadata! Can not send/receive multiple streams`);
        }

        try {
            await this.peerConnection.setRemoteDescription(content.offer);
            await this.addBufferedIceCandidates();
        } catch (e) {
            this.logger.debug(`Call ${this.callId} failed to set remote description`, e);
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }

        // According to previous comments in this file, firefox at some point did not
        // add streams until media started arriving on them. Testing latest firefox
        // (81 at time of writing), this is no longer a problem, so let's do it the correct way.
        if (this.peerConnection.remoteTracks.length === 0) {
            this.logger.error(`Call ${this.callId} no remote stream or no tracks after setting remote description!`);
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }

        this.setState(CallState.Ringing);

        setTimeout(() => {
            if (this.state == CallState.Ringing) {
                this.logger.debug(`Call ${this.callId} invite has expired. Hanging up.`);
                this.hangupParty = CallParty.Remote; // effectively
                this.setState(CallState.Ended);
                this.stopAllMedia();
                if (this.peerConnection.signalingState != 'closed') {
                    this.peerConnection.close();
                }
                this.emit(CallEvent.Hangup);
            }
        }, content.lifetime ?? CALL_TIMEOUT_MS /* - event.getLocalAge() */ );
    }

    private updateRemoteSDPStreamMetadata(metadata: SDPStreamMetadata): void {
        this.remoteSDPStreamMetadata = recursivelyAssign(this.remoteSDPStreamMetadata || {}, metadata, true);
        // will rerequest stream purpose for all tracks and set track.type accordingly
        this.peerConnection.notifyStreamPurposeChanged();
        for (const track of this.peerConnection.remoteTracks) {
            const streamMetaData = this.remoteSDPStreamMetadata?.[track.streamId];
            if (streamMetaData) {
                if (track.type === TrackType.Microphone) {
                    track.setMuted(streamMetaData.audio_muted);
                } else { // Camera or ScreenShare
                    track.setMuted(streamMetaData.video_muted);
                }
            }
        }
    }


    private async addBufferedIceCandidates(): Promise<void> {
        const bufferedCandidates = this.remoteCandidateBuffer!.get(this.opponentPartyId!);
        if (bufferedCandidates) {
            this.logger.info(`Call ${this.callId} Adding ${
                bufferedCandidates.length} buffered candidates for opponent ${this.opponentPartyId}`);
            await this.addIceCandidates(bufferedCandidates);
        }
        this.remoteCandidateBuffer = undefined;
    }

    private async addIceCandidates(candidates: RTCIceCandidate[]): Promise<void> {
        for (const candidate of candidates) {
            if (
                (candidate.sdpMid === null || candidate.sdpMid === undefined) &&
                (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined)
            ) {
                this.logger.debug(`Call ${this.callId} ignoring remote ICE candidate with no sdpMid or sdpMLineIndex`);
                continue;
            }
            this.logger.debug(`Call ${this.callId} got remote ICE ${candidate.sdpMid} candidate: ${candidate.candidate}`);
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                if (!this.ignoreOffer) {
                    this.logger.info(`Call ${this.callId} failed to add remote ICE candidate`, err);
                }
            }
        }
    }


    private setState(state: CallState): void {
        const oldState = this.state;
        this.state = state;
        this.handler.emitUpdate();
    }

    private waitForState(state: CallState): Promise<void> {
        
    }

    private async terminate(hangupParty: CallParty, hangupReason: CallErrorCode, shouldEmit: boolean): Promise<void> {

    }
}



//import { randomString } from '../randomstring';
import {
    MCallReplacesEvent,
    MCallAnswer,
    MCallInviteNegotiate,
    CallCapabilities,
    SDPStreamMetadataPurpose,
    SDPStreamMetadata,
    SDPStreamMetadataKey,
    MCallSDPStreamMetadataChanged,
    MCallSelectAnswer,
    MCAllAssertedIdentity,
    MCallCandidates,
    MCallBase,
    MCallHangupReject,
} from './callEventTypes';

// null is used as a special value meaning that the we're in a legacy 1:1 call
// without MSC2746 that doesn't provide an id which device sent the message.
type PartyId = string | null;

export enum CallParty {
    Local = 'local',
    Remote = 'remote',
}

export enum CallState {
    Fledgling = 'fledgling',
    InviteSent = 'invite_sent',
    WaitLocalMedia = 'wait_local_media',
    CreateOffer = 'create_offer',
    CreateAnswer = 'create_answer',
    Connecting = 'connecting',
    Connected = 'connected',
    Ringing = 'ringing',
    Ended = 'ended',
}

export enum CallDirection {
    Inbound = 'inbound',
    Outbound = 'outbound',
}

export enum EventType {
    Invite = "m.call.invite",
    Candidates = "m.call.candidates",
    Answer = "m.call.answer",
    Hangup = "m.call.hangup",
    Reject = "m.call.reject",
    SelectAnswer = "m.call.select_answer",
    Negotiate = "m.call.negotiate",
    SDPStreamMetadataChanged = "m.call.sdp_stream_metadata_changed",
    SDPStreamMetadataChangedPrefix = "org.matrix.call.sdp_stream_metadata_changed",
    Replaces = "m.call.replaces",
    AssertedIdentity = "m.call.asserted_identity",
    AssertedIdentityPrefix = "org.matrix.call.asserted_identity",
}

export enum CallErrorCode {
    /** The user chose to end the call */
    UserHangup = 'user_hangup',

    /** An error code when the local client failed to create an offer. */
    LocalOfferFailed = 'local_offer_failed',
    /**
     * An error code when there is no local mic/camera to use. This may be because
     * the hardware isn't plugged in, or the user has explicitly denied access.
     */
    NoUserMedia = 'no_user_media',

    /**
     * Error code used when a call event failed to send
     * because unknown devices were present in the room
     */
    UnknownDevices = 'unknown_devices',

    /**
     * Error code used when we fail to send the invite
     * for some reason other than there being unknown devices
     */
    SendInvite = 'send_invite',

    /**
     * An answer could not be created
     */
    CreateAnswer = 'create_answer',

    /**
     * Error code used when we fail to send the answer
     * for some reason other than there being unknown devices
     */
    SendAnswer = 'send_answer',

    /**
     * The session description from the other side could not be set
     */
    SetRemoteDescription = 'set_remote_description',

    /**
     * The session description from this side could not be set
     */
    SetLocalDescription = 'set_local_description',

    /**
     * A different device answered the call
     */
    AnsweredElsewhere = 'answered_elsewhere',

    /**
     * No media connection could be established to the other party
     */
    IceFailed = 'ice_failed',

    /**
     * The invite timed out whilst waiting for an answer
     */
    InviteTimeout = 'invite_timeout',

    /**
     * The call was replaced by another call
     */
    Replaced = 'replaced',

    /**
     * Signalling for the call could not be sent (other than the initial invite)
     */
    SignallingFailed = 'signalling_timeout',

    /**
     * The remote party is busy
     */
    UserBusy = 'user_busy',

    /**
     * We transferred the call off to somewhere else
     */
    Transfered = 'transferred',

    /**
     * A call from the same user was found with a new session id
     */
    NewSession = 'new_session',
}

/**
 * The version field that we set in m.call.* events
 */
const VOIP_PROTO_VERSION = 1;

/** The fallback ICE server to use for STUN or TURN protocols. */
const FALLBACK_ICE_SERVER = 'stun:turn.matrix.org';

/** The length of time a call can be ringing for. */
const CALL_TIMEOUT_MS = 60000;

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export class CallError extends Error {
    code: string;

    constructor(code: CallErrorCode, msg: string, err: Error) {
        // Still don't think there's any way to have proper nested errors
        super(msg + ": " + err);

        this.code = code;
    }
}

type InviteContent = {
    offer: RTCSessionDescriptionInit,
    [SDPStreamMetadataKey]: SDPStreamMetadata,
    version?: number,
    lifetime?: number
}

export type InviteMessage = {
    type: EventType.Invite,
    content: InviteContent
}

export type SignallingMessage = InviteMessage;

export interface PeerCallHandler {
    emitUpdate(peerCall: PeerCall, params: any);
    sendSignallingMessage(message: InviteMessage);
}
