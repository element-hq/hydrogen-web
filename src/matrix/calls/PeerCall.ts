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

import {AsyncQueue} from "../../utils/AsyncQueue";
import type {Room} from "../room/Room";
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";

import {WebRTC, PeerConnection, PeerConnectionHandler, StreamPurpose} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";

import { randomString } from '../randomstring';
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


const GROUP_CALL_TYPE = "m.call";
const GROUP_CALL_MEMBER_TYPE = "m.call.member";


/**
 * Fires whenever an error occurs when call.js encounters an issue with setting up the call.
 * <p>
 * The error given will have a code equal to either `MatrixCall.ERR_LOCAL_OFFER_FAILED` or
 * `MatrixCall.ERR_NO_USER_MEDIA`. `ERR_LOCAL_OFFER_FAILED` is emitted when the local client
 * fails to create an offer. `ERR_NO_USER_MEDIA` is emitted when the user has denied access
 * to their audio/video hardware.
 *
 * @event module:webrtc/call~MatrixCall#"error"
 * @param {Error} err The error raised by MatrixCall.
 * @example
 * matrixCall.on("error", function(err){
 *   console.error(err.code, err);
 * });
 */

// null is used as a special value meaning that the we're in a legacy 1:1 call
// without MSC2746 that doesn't provide an id which device sent the message.
type PartyId = string | null;

interface TurnServer {
    urls: Array<string>;
    username?: string;
    password?: string;
    ttl?: number;
}

interface AssertedIdentity {
    id: string;
    displayName: string;
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

export enum CallType {
    Voice = 'voice',
    Video = 'video',
}

export enum CallDirection {
    Inbound = 'inbound',
    Outbound = 'outbound',
}

export enum CallParty {
    Local = 'local',
    Remote = 'remote',
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

export enum CallEvent {
    Hangup = 'hangup',
    State = 'state',
    Error = 'error',
    Replaced = 'replaced',

    // The value of isLocalOnHold() has changed
    LocalHoldUnhold = 'local_hold_unhold',
    // The value of isRemoteOnHold() has changed
    RemoteHoldUnhold = 'remote_hold_unhold',
    // backwards compat alias for LocalHoldUnhold: remove in a major version bump
    HoldUnhold = 'hold_unhold',
    // Feeds have changed
    FeedsChanged = 'feeds_changed',

    AssertedIdentityChanged = 'asserted_identity_changed',

    LengthChanged = 'length_changed',

    DataChannel = 'datachannel',

    SendVoipEvent = "send_voip_event",
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

export function genCallID(): string {
    return Date.now().toString() + randomString(16);
}

enum CallSetupMessageType {
    Invite = "m.call.invite",
    Answer = "m.call.answer",
    Candidates = "m.call.candidates",
    Hangup = "m.call.hangup",
}

const CALL_ID = "m.call_id";
const CALL_TERMINATED = "m.terminated";

class LocalMedia {
    constructor(
        public readonly cameraTrack?: Track,
        public readonly screenShareTrack?: Track,
        public readonly microphoneTrack?: AudioTrack
    ) {}

    withTracks(tracks: Track[]) {
        const cameraTrack = tracks.find(t => t.type === TrackType.Camera) ?? this.cameraTrack;
        const screenShareTrack = tracks.find(t => t.type === TrackType.ScreenShare) ?? this.screenShareTrack;
        const microphoneTrack = tracks.find(t => t.type === TrackType.Microphone) ?? this.microphoneTrack;
        if (cameraTrack && microphoneTrack && cameraTrack.streamId !== microphoneTrack.streamId) {
            throw new Error("The camera and audio track should have the same stream id");
        }
        return new LocalMedia(cameraTrack, screenShareTrack, microphoneTrack as AudioTrack);
    }

    get tracks(): Track[] { return []; }

    getSDPMetadata(): any {
        const metadata = {};
        const userMediaTrack = this.microphoneTrack ?? this.cameraTrack;
        if (userMediaTrack) {
            metadata[userMediaTrack.streamId] = {
                purpose: StreamPurpose.UserMedia,
                audio_muted: this.microphoneTrack?.muted ?? false,
                video_muted: this.cameraTrack?.muted ?? false,
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

export type InviteMessage = {
    type: EventType.Invite,
    content: {
        version: number
    }
}

export interface PeerCallHandler {
    emitUpdate(peerCall: PeerCall, params: any);
    sendSignallingMessage(type: EventType, content: Record<string, any>);
}

// when sending, we need to encrypt message with olm. I think the flow of room => roomEncryption => olmEncryption as we already
// do for sharing keys will be best as that already deals with room tracking.
/**
 * Does WebRTC signalling for a single PeerConnection, and deals with WebRTC wrappers from platform
 * */
/** Implements a call between two peers with the signalling state keeping, while still delegating the signalling message sending. Used by GroupCall.*/
class PeerCall implements PeerConnectionHandler {
    private readonly peerConnection: PeerConnection;


    public state = CallState.Fledgling;
    public hangupParty: CallParty;
    public hangupReason: string;
    public direction: CallDirection;
    public peerConn?: RTCPeerConnection;

    // A queue for candidates waiting to go out.
    // We try to amalgamate candidates into a single candidate message where
    // possible
    private candidateSendQueue: Array<RTCIceCandidate> = [];
    private candidateSendTries = 0;
    private sentEndOfCandidates = false;
    
    private inviteOrAnswerSent = false;
    private waitForLocalAVStream: boolean;
    private opponentVersion: number | string;
    // The party ID of the other side: undefined if we haven't chosen a partner
    // yet, null if we have but they didn't send a party ID.
    private opponentPartyId: PartyId;
    private opponentCaps: CallCapabilities;
    private inviteTimeout: number;
    private iceDisconnectedTimeout: number;

    // The logic of when & if a call is on hold is nontrivial and explained in is*OnHold
    // This flag represents whether we want the other party to be on hold
    private remoteOnHold = false;

    // the stats for the call at the point it ended. We can't get these after we
    // tear the call down, so we just grab a snapshot before we stop the call.
    // The typescript definitions have this type as 'any' :(
    private callStatsAtEnd: any[];

    // Perfect negotiation state: https://www.w3.org/TR/webrtc/#perfect-negotiation-example
    private makingOffer = false;
    private ignoreOffer: boolean;

    // If candidates arrive before we've picked an opponent (which, in particular,
    // will happen if the opponent sends candidates eagerly before the user answers
    // the call) we buffer them up here so we can then add the ones from the party we pick
    private remoteCandidateBuffer: Map<PartyId, RTCIceCandidate[]>;

    private remoteAssertedIdentity: AssertedIdentity;

    private remoteSDPStreamMetadata?: SDPStreamMetadata;

    private negotiationQueue: AsyncQueue<void, void>;

    constructor(
        private readonly handler: PeerCallHandler,
        private localMedia: LocalMedia,
        webRTC: WebRTC
    ) {
        this.peerConnection = webRTC.createPeerConnection(this);
        // TODO: should we use this to serialize all state changes?
        this.negotiationQueue = new AsyncQueue(this.handleNegotiation, void);
    }

    // PeerConnectionHandler method
    onIceConnectionStateChange(state: RTCIceConnectionState) {}
    // PeerConnectionHandler method
    onLocalIceCandidate(candidate: RTCIceCandidate) {}
    // PeerConnectionHandler method
    onIceGatheringStateChange(state: RTCIceGatheringState) {}
    // PeerConnectionHandler method
    onRemoteTracksChanged(tracks: Track[]) {}
    // PeerConnectionHandler method
    onDataChannelChanged(dataChannel: DataChannel | undefined) {}
    // PeerConnectionHandler method
    onNegotiationNeeded() {
        // trigger handleNegotiation
        this.negotiationQueue.push(void);   
    }

    // calls are serialized and deduplicated by negotiationQueue
    private handleNegotiation = async (): Promise<void> => {
        const offer = await this.peerConnection.createOffer();
        this.peerConnection.setLocalDescription(offer);
        // need to queue this
        const message = {
            offer,
            sdp_stream_metadata: this.localMedia.getSDPMetadata(),
            version: 1
        }
        if (this.state === CallState.Fledgling) {
            const sendPromise = this.handler.sendSignallingMessage(EventType.Invite, message);
            this.setState(CallState.InviteSent);
        } else {
            await this.handler.sendSignallingMessage(EventType.Negotiate, message);
        }
    };

    async sendInvite(localMediaPromise: Promise<LocalMedia>): Promise<void> {
        if (this.state !== CallState.Fledgling) {
            return;
        }
        this.setState(CallState.WaitLocalMedia);
        this.localMedia = await localMediaPromise;
        // add the local tracks, and wait for onNegotiationNeeded and handleNegotiation to be called
        for (const t of this.localMedia.tracks) {
            this.peerConnection.addTrack(t);
        }
        await this.waitForState(CallState.Ended, CallState.InviteSent);
    }

    async sendAnswer(localMediaPromise: Promise<LocalMedia>): Promise<void> {
        if (this.callHasEnded()) return;

        if (this.state !== CallState.Ringing) {
            return;
        }

        this.setState(CallState.WaitLocalMedia);
        this.waitForLocalAVStream = true;
        this.localMedia = await localMediaPromise;
        this.waitForLocalAVStream = false;
        
        // enqueue the following

        // add the local tracks, and wait for onNegotiationNeeded and handleNegotiation to be called
        for (const t of this.localMedia.tracks) {
            this.peerConnection.addTrack(t);
        }

        this.setState(CallState.CreateAnswer);

        let myAnswer;
        try {
            myAnswer = await this.peerConn.createAnswer();
        } catch (err) {
            logger.debug("Failed to create answer: ", err);
            this.terminate(CallParty.Local, CallErrorCode.CreateAnswer, true);
            return;
        }

        try {
            await this.peerConn.setLocalDescription(myAnswer);
            this.setState(CallState.Connecting);

            // Allow a short time for initial candidates to be gathered
            await new Promise(resolve => {
                setTimeout(resolve, 200);
            });
            // inlined sendAnswer
            const answerContent = {
                answer: {
                    sdp: this.peerConn.localDescription.sdp,
                    // type is now deprecated as of Matrix VoIP v1, but
                    // required to still be sent for backwards compat
                    type: this.peerConn.localDescription.type,
                },
                [SDPStreamMetadataKey]: this.getLocalSDPStreamMetadata(true),
            } as MCallAnswer;

            answerContent.capabilities = {
                'm.call.transferee': this.client.supportsCallTransfer,
                'm.call.dtmf': false,
            };

            // We have just taken the local description from the peerConn which will
            // contain all the local candidates added so far, so we can discard any candidates
            // we had queued up because they'll be in the answer.
            logger.info(`Discarding ${this.candidateSendQueue.length} candidates that will be sent in answer`);
            this.candidateSendQueue = [];

            try {
                await this.sendVoipEvent(EventType.CallAnswer, answerContent);
                // If this isn't the first time we've tried to send the answer,
                // we may have candidates queued up, so send them now.
                this.inviteOrAnswerSent = true;
            } catch (error) {
                // We've failed to answer: back to the ringing state
                this.setState(CallState.Ringing);
                this.client.cancelPendingEvent(error.event);

                let code = CallErrorCode.SendAnswer;
                let message = "Failed to send answer";
                if (error.name == 'UnknownDeviceError') {
                    code = CallErrorCode.UnknownDevices;
                    message = "Unknown devices present in the room";
                }
                this.emit(CallEvent.Error, new CallError(code, message, error));
                throw error;
            }

            // error handler re-throws so this won't happen on error, but
            // we don't want the same error handling on the candidate queue
            this.sendCandidateQueue();
        } catch (err) {
            logger.debug("Error setting local description!", err);
            this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, true);
            return;
        }
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


    /**
     * Replace this call with a new call, e.g. for glare resolution. Used by
     * MatrixClient.
     * @param {MatrixCall} newCall The new call.
     */
    public replacedBy(newCall: MatrixCall): void {
        if (this.state === CallState.WaitLocalMedia) {
            logger.debug("Telling new call to wait for local media");
            newCall.waitForLocalAVStream = true;
        } else if ([CallState.CreateOffer, CallState.InviteSent].includes(this.state)) {
            if (newCall.direction === CallDirection.Outbound) {
                newCall.queueGotCallFeedsForAnswer([]);
            } else {
                logger.debug("Handing local stream to new call");
                newCall.queueGotCallFeedsForAnswer(this.getLocalFeeds().map(feed => feed.clone()));
            }
        }
        this.successor = newCall;
        this.emit(CallEvent.Replaced, newCall);
        this.hangup(CallErrorCode.Replaced, true);
    }

    /**
     * Hangup a call.
     * @param {string} reason The reason why the call is being hung up.
     * @param {boolean} suppressEvent True to suppress emitting an event.
     */
    public hangup(reason: CallErrorCode, suppressEvent: boolean): void {
        if (this.callHasEnded()) return;

        logger.debug("Ending call " + this.callId);
        this.terminate(CallParty.Local, reason, !suppressEvent);
        // We don't want to send hangup here if we didn't even get to sending an invite
        if (this.state === CallState.WaitLocalMedia) return;
        const content = {};
        // Don't send UserHangup reason to older clients
        if ((this.opponentVersion && this.opponentVersion >= 1) || reason !== CallErrorCode.UserHangup) {
            content["reason"] = reason;
        }
        this.sendVoipEvent(EventType.CallHangup, content);
    }

    /**
     * Reject a call
     * This used to be done by calling hangup, but is a separate method and protocol
     * event as of MSC2746.
     */
    public reject(): void {
        if (this.state !== CallState.Ringing) {
            throw Error("Call must be in 'ringing' state to reject!");
        }

        if (this.opponentVersion < 1) {
            logger.info(
                `Opponent version is less than 1 (${this.opponentVersion}): sending hangup instead of reject`,
            );
            this.hangup(CallErrorCode.UserHangup, true);
            return;
        }

        logger.debug("Rejecting call: " + this.callId);
        this.terminate(CallParty.Local, CallErrorCode.UserHangup, true);
        this.sendVoipEvent(EventType.CallReject, {});
    }

    // request the type of incoming track
    getPurposeForStreamId(streamId: string): StreamPurpose {
        // TODO: should we return a promise here for the case where the metadata hasn't arrived yet?
        const metaData = this.remoteSDPStreamMetadata[streamId];
        return metadata?.purpose as StreamPurpose ?? StreamPurpose.UserMedia;
    }

    private setState(state: CallState): void {
        const oldState = this.state;
        this.state = state;
        this.handler.emitUpdate();
        if (this.inviteDeferred) {
            if (this.state === CallState.InviteSent) {
                this.inviteDeferred.resolve();   
            }
        }
    }

    handleIncomingSignallingMessage(type: CallSetupMessageType, content: Record<string, any>, partyId: PartyId) {
        switch (type) {
            case CallSetupMessageType.Invite:
            case CallSetupMessageType.Answer:
                this.handleAnswer(content);
                break;
            case CallSetupMessageType.Candidates:
                this.handleRemoteIceCandidates(content);
                break;
            case CallSetupMessageType.Hangup:
        }
    }

    private async handleAnswer(content: MCallAnswer, partyId: PartyId) {
        // add buffered ice candidates to peerConnection
        if (this.opponentPartyId !== undefined) {
            return;
        }
        this.opponentPartyId = partyId;
        const bufferedCandidates = this.remoteCandidateBuffer?.get(partyId);
        if (bufferedCandidates) {
            this.addIceCandidates(bufferedCandidates);
        }
        this.remoteCandidateBuffer = undefined;

        this.setState(CallState.Connecting);

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
        } else {
            logger.warn("Did not get any SDPStreamMetadata! Can not send/receive multiple streams");
        }

        try {
            await this.peerConnection.setRemoteDescription(content.answer);
        } catch (e) {
            logger.debug("Failed to set remote description", e);
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }

        // If the answer we selected has a party_id, send a select_answer event
        // We do this after setting the remote description since otherwise we'd block
        // call setup on it
        if (this.opponentPartyId !== null) {
            try {
                await this.sendVoipEvent(EventType.CallSelectAnswer, {
                    selected_party_id: this.opponentPartyId,
                });
            } catch (err) {
                // This isn't fatal, and will just mean that if another party has raced to answer
                // the call, they won't know they got rejected, so we carry on & don't retry.
                logger.warn("Failed to send select_answer event", err);
            }
        }
    }

    private handleRemoteIceCandidates(content: Record<string, any>) {
        if (this.state === CallState.Ended) {
            return;
        }
        const candidates = content.candidates;
        if (!candidates) {
            return;
        }
        if (this.opponentPartyId === undefined) {
            if (!this.remoteCandidateBuffer) {
                this.remoteCandidateBuffer = new Map();
            }
            const bufferedCandidates = this.remoteCandidateBuffer.get(fromPartyId) || [];
            bufferedCandidates.push(...candidates);
            this.remoteCandidateBuffer.set(fromPartyId, bufferedCandidates);
        } else {
            this.addIceCandidates(candidates);
        }
    }

    private async addIceCandidates(candidates: RTCIceCandidate[]): Promise<void> {
        for (const candidate of candidates) {
            if (
                (candidate.sdpMid === null || candidate.sdpMid === undefined) &&
                (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined)
            ) {
                logger.debug("Ignoring remote ICE candidate with no sdpMid or sdpMLineIndex");
                continue;
            }
            logger.debug(
                "Call " + this.callId + " got remote ICE " + candidate.sdpMid + " candidate: " + candidate.candidate,
            );
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                if (!this.ignoreOffer) {
                    logger.info("Failed to add remote ICE candidate", err);
                }
            }
        }
    }
}
