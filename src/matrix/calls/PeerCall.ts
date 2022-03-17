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
import {Disposables, IDisposable} from "../../utils/Disposables";
import type {Room} from "../room/Room";
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";
import {Instance as logger} from "../../logging/NullLogger";

import type {TimeoutCreator, Timeout} from "../../platform/types/types";
import {WebRTC, PeerConnection, PeerConnectionHandler, DataChannel} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, TrackType} from "../../platform/types/MediaDevices";
import type {LocalMedia} from "./LocalMedia";

import {
    SDPStreamMetadataKey,
    SDPStreamMetadataPurpose,
    EventType,
} from "./callEventTypes";
import type {
    MCallBase,
    MCallInvite,
    MCallAnswer,
    MCallSDPStreamMetadataChanged,
    MCallCandidates,
    MCallHangupReject,
    SDPStreamMetadata,
    SignallingMessage
} from "./callEventTypes";

export type Options = {
    webRTC: WebRTC,
    createTimeout: TimeoutCreator,
    emitUpdate: (peerCall: PeerCall, params: any) => void;
    sendSignallingMessage: (message: SignallingMessage<MCallBase>, log: ILogItem) => Promise<void>;
};

// when sending, we need to encrypt message with olm. I think the flow of room => roomEncryption => olmEncryption as we already
// do for sharing keys will be best as that already deals with room tracking.
/**
 * Does WebRTC signalling for a single PeerConnection, and deals with WebRTC wrappers from platform
 * */
/** Implements a call between two peers with the signalling state keeping, while still delegating the signalling message sending. Used by GroupCall.*/
export class PeerCall implements IDisposable {
    private readonly peerConnection: PeerConnection;
    private _state = CallState.Fledgling;
    private direction: CallDirection;
    private localMedia?: LocalMedia;
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
    private hangupParty: CallParty;
    private disposables = new Disposables();
    private statePromiseMap = new Map<CallState, {resolve: () => void, promise: Promise<void>}>();

    // perfect negotiation flags
    private makingOffer: boolean = false;
    private ignoreOffer: boolean = false;

    private sentEndOfCandidates: boolean = false;
    private iceDisconnectedTimeout?: Timeout;

    constructor(
        private callId: string,
        private readonly options: Options
    ) {
        const outer = this;
        this.peerConnection = options.webRTC.createPeerConnection({
            onIceConnectionStateChange(state: RTCIceConnectionState) {
                outer.onIceConnectionStateChange(state);
            },
            onLocalIceCandidate(candidate: RTCIceCandidate) {
                outer.handleLocalIceCandidate(candidate);
            },
            onIceGatheringStateChange(state: RTCIceGatheringState) {
                outer.handleIceGatheringState(state);
            },
            onRemoteTracksChanged(tracks: Track[]) {
                outer.options.emitUpdate(outer, undefined);
            },
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
        };
    }

    get state(): CallState { return this._state; }

    get remoteTracks(): Track[] {
        return this.peerConnection.remoteTracks;
    }

    async call(localMedia: LocalMedia): Promise<void> {
        if (this._state !== CallState.Fledgling) {
            return;
        }
        this.localMedia = localMedia;
        this.direction = CallDirection.Outbound;
        this.setState(CallState.CreateOffer);
        for (const t of this.localMedia.tracks) {
            this.peerConnection.addTrack(t);
        }
        // after adding the local tracks, and wait for handleNegotiation to be called,
        // or invite glare where we give up our invite and answer instead
        await this.waitForState([CallState.InviteSent, CallState.CreateAnswer]);
    }

    async answer(localMedia: LocalMedia): Promise<void> {
        if (this._state !== CallState.Ringing) {
            return;
        }
        this.localMedia = localMedia;
        this.setState(CallState.CreateAnswer);
        for (const t of this.localMedia.tracks) {
            this.peerConnection.addTrack(t);
        }

        let myAnswer: RTCSessionDescriptionInit;
        try {
            myAnswer = await this.peerConnection.createAnswer();
        } catch (err) {
            this.logger.debug(`Call ${this.callId} Failed to create answer: `, err);
            this.terminate(CallParty.Local, CallErrorCode.CreateAnswer, true);
            return;
        }

        try {
            await this.peerConnection.setLocalDescription(myAnswer);
            this.setState(CallState.Connecting);
        } catch (err) {
            this.logger.debug(`Call ${this.callId} Error setting local description!`, err);
            this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, true);
            return;
        }
        // Allow a short time for initial candidates to be gathered
        await this.delay(200);
        await this.sendAnswer();
    }

    async setMedia(localMediaPromise: Promise<LocalMedia>) {
        const oldMedia = this.localMedia;
        this.localMedia = await localMediaPromise;

        const applyTrack = (selectTrack: (media: LocalMedia | undefined) => Track | undefined) => {
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
        applyTrack(m => m?.microphoneTrack);
        applyTrack(m => m?.cameraTrack);
        applyTrack(m => m?.screenShareTrack);
    }

    async reject() {

    }

    async hangup(errorCode: CallErrorCode): Promise<void> {
        if (this._state !== CallState.Ended) {
            this._state = CallState.Ended;
            await this.sendHangupWithCallId(this.callId, errorCode);
        }
    }

    async handleIncomingSignallingMessage<B extends MCallBase>(message: SignallingMessage<B>, partyId: PartyId, log: ILogItem): Promise<void> {
        switch (message.type) {
            case EventType.Invite:
                if (this.callId !== message.content.call_id) {
                    await this.handleInviteGlare(message.content, partyId);
                } else {
                    await this.handleFirstInvite(message.content, partyId);
                }
                break;
            case EventType.Answer:
                await this.handleAnswer(message.content, partyId);
                break;
            case EventType.Candidates:
                await this.handleRemoteIceCandidates(message.content, partyId);
                break;
            case EventType.Hangup:
            default:
                throw new Error(`Unknown event type for call: ${message.type}`);
        }
    }

    private sendHangupWithCallId(callId: string, reason?: CallErrorCode): Promise<void> {
        const content = {
            call_id: callId,
            version: 1,
        };
        if (reason) {
            content["reason"] = reason;
        }
        return this.options.sendSignallingMessage({
            type: EventType.Hangup,
            content
        }, logger.item);
    }

    // calls are serialized and deduplicated by responsePromiseChain
    private handleNegotiation = async (): Promise<void> => {
        this.makingOffer = true;
        try {
            try {
                await this.peerConnection.setLocalDescription();
            } catch (err) {
                this.logger.debug(`Call ${this.callId} Error setting local description!`, err);
                this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, true);
                return;
            }

            if (this.peerConnection.iceGatheringState === 'gathering') {
                // Allow a short time for initial candidates to be gathered
                await this.delay(200);
            }

            if (this._state === CallState.Ended) {
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
                call_id: this.callId,
                offer,
                [SDPStreamMetadataKey]: this.localMedia!.getSDPMetadata(),
                version: 1,
                lifetime: CALL_TIMEOUT_MS
            };
            if (this._state === CallState.CreateOffer) {
                await this.options.sendSignallingMessage({type: EventType.Invite, content}, logger.item);
                this.setState(CallState.InviteSent);
            } else if (this._state === CallState.Connected || this._state === CallState.Connecting) {
                // send Negotiate message
                //await this.options.sendSignallingMessage({type: EventType.Invite, content});
                //this.setState(CallState.InviteSent);
            }
        } finally {
            this.makingOffer = false;
        }

        this.sendCandidateQueue();

        if (this._state === CallState.InviteSent) {
            await this.delay(CALL_TIMEOUT_MS);
            // @ts-ignore TS doesn't take the await above into account to know that the state could have changed in between
            if (this._state === CallState.InviteSent) {
                this.hangup(CallErrorCode.InviteTimeout);
            }
        }
    };

    private async handleInviteGlare(content: MCallInvite<MCallBase>, partyId: PartyId): Promise<void> {
        // this is only called when the ids are different
        const newCallId = content.call_id;
        if (this.callId! > newCallId) {
            this.logger.log(
                "Glare detected: answering incoming call " + newCallId +
                " and canceling outgoing call " + this.callId,
            );
            // How do we interrupt `call()`? well, perhaps we need to not just await InviteSent but also CreateAnswer?
            if (this._state === CallState.Fledgling || this._state === CallState.CreateOffer) {
                // TODO: don't send invite!
            } else {
                await this.sendHangupWithCallId(this.callId, CallErrorCode.Replaced);
            }
            await this.handleInvite(content, partyId);
            // TODO: need to skip state check
            await this.answer(this.localMedia!);
        } else {
            this.logger.log(
                "Glare detected: rejecting incoming call " + newCallId +
                " and keeping outgoing call " + this.callId,
            );
            await this.sendHangupWithCallId(newCallId, CallErrorCode.Replaced);
        }
    }

    private async handleFirstInvite(content: MCallInvite<MCallBase>, partyId: PartyId): Promise<void> {
        if (this._state !== CallState.Fledgling || this.opponentPartyId !== undefined) {
            // TODO: hangup or ignore?
            return;
        }
        await this.handleInvite(content, partyId);
    }

    private async handleInvite(content: MCallInvite<MCallBase>, partyId: PartyId): Promise<void> {

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
            // Q: Why do we set the remote description before accepting the call? To start creating ICE candidates?
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

        await this.delay(content.lifetime ?? CALL_TIMEOUT_MS);
        // @ts-ignore TS doesn't take the await above into account to know that the state could have changed in between
        if (this._state === CallState.Ringing) {
            this.logger.debug(`Call ${this.callId} invite has expired. Hanging up.`);
            this.hangupParty = CallParty.Remote; // effectively
            this.setState(CallState.Ended);
            this.stopAllMedia();
            if (this.peerConnection.signalingState != 'closed') {
                this.peerConnection.close();
            }
        }
    }

    private async handleAnswer(content: MCallAnswer<MCallBase>, partyId: PartyId): Promise<void> {
        this.logger.debug(`Got answer for call ID ${this.callId} from party ID ${partyId}`);

        if (this._state === CallState.Ended) {
            this.logger.debug(`Ignoring answer because call ID ${this.callId} has ended`);
            return;
        }

        if (this.opponentPartyId !== undefined) {
            this.logger.info(
                `Call ${this.callId} ` +
                `Ignoring answer from party ID ${partyId}: ` +
                `we already have an answer/reject from ${this.opponentPartyId}`,
            );
            return;
        }

        this.opponentPartyId = partyId;
        await this.addBufferedIceCandidates();

        this.setState(CallState.Connecting);

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
        } else {
            this.logger.warn(`Call ${this.callId} Did not get any SDPStreamMetadata! Can not send/receive multiple streams`);
        }

        try {
            await this.peerConnection.setRemoteDescription(content.answer);
        } catch (e) {
            this.logger.debug(`Call ${this.callId} Failed to set remote description`, e);
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }
    }

    private handleIceGatheringState(state: RTCIceGatheringState) {
        this.logger.debug(`Call ${this.callId} ice gathering state changed to  ${state}`);
        if (state === 'complete' && !this.sentEndOfCandidates) {
            // If we didn't get an empty-string candidate to signal the end of candidates,
            // create one ourselves now gathering has finished.
            // We cast because the interface lists all the properties as required but we
            // only want to send 'candidate'
            // XXX: We probably want to send either sdpMid or sdpMLineIndex, as it's not strictly
            // correct to have a candidate that lacks both of these. We'd have to figure out what
            // previous candidates had been sent with and copy them.
            const c = {
                candidate: '',
            } as RTCIceCandidate;
            this.queueCandidate(c);
            this.sentEndOfCandidates = true;
        }
    }

    private handleLocalIceCandidate(candidate: RTCIceCandidate) {
        this.logger.debug(
            "Call " + this.callId + " got local ICE " + candidate.sdpMid + " candidate: " +
            candidate.candidate,
        );

        if (this._state === CallState.Ended) return;

        // As with the offer, note we need to make a copy of this object, not
        // pass the original: that broke in Chrome ~m43.
        if (candidate.candidate !== '' || !this.sentEndOfCandidates) {
            this.queueCandidate(candidate);

            if (candidate.candidate === '') this.sentEndOfCandidates = true;
        }
    }

    private async handleRemoteIceCandidates(content: MCallCandidates<MCallBase>, partyId) {
        if (this.state === CallState.Ended) {
            //debuglog("Ignoring remote ICE candidate because call has ended");
            return;
        }

        const candidates = content.candidates;
        if (!candidates) {
            this.logger.info(`Call ${this.callId} Ignoring candidates event with no candidates!`);
            return;
        }

        const fromPartyId = content.version === 0 ? null : partyId || null;

        if (this.opponentPartyId === undefined) {
            // we haven't picked an opponent yet so save the candidates
            this.logger.info(`Call ${this.callId} Buffering ${candidates.length} candidates until we pick an opponent`);
            const bufferedCandidates = this.remoteCandidateBuffer!.get(fromPartyId) || [];
            bufferedCandidates.push(...candidates);
            this.remoteCandidateBuffer!.set(fromPartyId, bufferedCandidates);
            return;
        }

        if (this.opponentPartyId !== partyId) {
            this.logger.info(
                `Call ${this.callId} `+
                `Ignoring candidates from party ID ${partyId}: ` +
                `we have chosen party ID ${this.opponentPartyId}`,
            );

            return;
        }

        await this.addIceCandidates(candidates);
    }

    // private async onNegotiateReceived(event: MatrixEvent): Promise<void> {
    //     const content = event.getContent<MCallNegotiate>();
    //     const description = content.description;
    //     if (!description || !description.sdp || !description.type) {
    //         this.logger.info(`Call ${this.callId} Ignoring invalid m.call.negotiate event`);
    //         return;
    //     }
    //     // Politeness always follows the direction of the call: in a glare situation,
    //     // we pick either the inbound or outbound call, so one side will always be
    //     // inbound and one outbound
    //     const polite = this.direction === CallDirection.Inbound;

    //     // Here we follow the perfect negotiation logic from
    //     // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
    //     const offerCollision = (
    //         (description.type === 'offer') &&
    //         (this.makingOffer || this.peerConnection.signalingState !== 'stable')
    //     );

    //     this.ignoreOffer = !polite && offerCollision;
    //     if (this.ignoreOffer) {
    //         this.logger.info(`Call ${this.callId} Ignoring colliding negotiate event because we're impolite`);
    //         return;
    //     }

    //     const sdpStreamMetadata = content[SDPStreamMetadataKey];
    //     if (sdpStreamMetadata) {
    //         this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
    //     } else {
    //         this.logger.warn(`Call ${this.callId} Received negotiation event without SDPStreamMetadata!`);
    //     }

    //     try {
    //         await this.peerConnection.setRemoteDescription(description);

    //         if (description.type === 'offer') {
    //             await this.peerConnection.setLocalDescription();
    //             await this.options.sendSignallingMessage({
    //                 type: EventType.CallNegotiate,
    //                 content: {
    //                     description: this.peerConnection.localDescription!,
    //                     [SDPStreamMetadataKey]: this.localMedia.getSDPMetadata(),
    //                 }
    //             });
    //         }
    //     } catch (err) {
    //         this.logger.warn(`Call ${this.callId} Failed to complete negotiation`, err);
    //     }
    // }

    private async sendAnswer(): Promise<void> {
        const localDescription = this.peerConnection.localDescription!;
        const answerContent: MCallAnswer<MCallBase> = {
            call_id: this.callId,
            version: 1,
            answer: {
                sdp: localDescription.sdp,
                type: localDescription.type,
            },
            [SDPStreamMetadataKey]: this.localMedia!.getSDPMetadata(),
        };

        // We have just taken the local description from the peerConn which will
        // contain all the local candidates added so far, so we can discard any candidates
        // we had queued up because they'll be in the answer.
        this.logger.info(`Call ${this.callId} Discarding ${
            this.candidateSendQueue.length} candidates that will be sent in answer`);
        this.candidateSendQueue = [];

        try {
            await this.options.sendSignallingMessage({type: EventType.Answer, content: answerContent}, logger.item);
        } catch (error) {
            this.terminate(CallParty.Local, CallErrorCode.SendAnswer, false);
            throw error;
        }

        // error handler re-throws so this won't happen on error, but
        // we don't want the same error handling on the candidate queue
        this.sendCandidateQueue();
    }

    private queueCandidate(content: RTCIceCandidate): void {
        // We partially de-trickle candidates by waiting for `delay` before sending them
        // amalgamated, in order to avoid sending too many m.call.candidates events and hitting
        // rate limits in Matrix.
        // In practice, it'd be better to remove rate limits for m.call.*

        // N.B. this deliberately lets you queue and send blank candidates, which MSC2746
        // currently proposes as the way to indicate that candidate gathering is complete.
        // This will hopefully be changed to an explicit rather than implicit notification
        // shortly.
        this.candidateSendQueue.push(content);

        // Don't send the ICE candidates yet if the call is in the ringing state
        if (this._state === CallState.Ringing) return;

        // MSC2746 recommends these values (can be quite long when calling because the
        // callee will need a while to answer the call)
        this.delay(this.direction === CallDirection.Inbound ? 500 : 2000).then(() => {
            this.sendCandidateQueue();
        });
    }

    private async sendCandidateQueue(): Promise<void> {
        if (this.candidateSendQueue.length === 0 || this._state === CallState.Ended) {
            return;
        }

        const candidates = this.candidateSendQueue;
        this.candidateSendQueue = [];
        this.logger.debug(`Call ${this.callId} attempting to send ${candidates.length} candidates`);
        try {
            await this.options.sendSignallingMessage({
                type: EventType.Candidates,
                content: {
                    call_id: this.callId,
                    version: 1,
                    candidates
                },
            }, logger.item);
            // Try to send candidates again just in case we received more candidates while sending.
            this.sendCandidateQueue();
        } catch (error) {
            // don't retry this event: we'll send another one later as we might
            // have more candidates by then.
            // put all the candidates we failed to send back in the queue
            this.terminate(CallParty.Local, CallErrorCode.SignallingFailed, false);
        }
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
        if (this.remoteCandidateBuffer && this.opponentPartyId) {
            const bufferedCandidates = this.remoteCandidateBuffer.get(this.opponentPartyId);
            if (bufferedCandidates) {
                this.logger.info(`Call ${this.callId} Adding ${
                    bufferedCandidates.length} buffered candidates for opponent ${this.opponentPartyId}`);
                await this.addIceCandidates(bufferedCandidates);
            }
            this.remoteCandidateBuffer = undefined;
        }
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

    private onIceConnectionStateChange = (state: RTCIceConnectionState): void => {
        if (this._state === CallState.Ended) {
            return; // because ICE can still complete as we're ending the call
        }
        this.logger.debug(
            "Call ID " + this.callId + ": ICE connection state changed to: " + state,
        );
        // ideally we'd consider the call to be connected when we get media but
        // chrome doesn't implement any of the 'onstarted' events yet
        if (state == 'connected') {
            this.iceDisconnectedTimeout?.abort();
            this.iceDisconnectedTimeout = undefined;
            this.setState(CallState.Connected);
        } else if (state == 'failed') {
            this.iceDisconnectedTimeout?.abort();
            this.iceDisconnectedTimeout = undefined;
            this.hangup(CallErrorCode.IceFailed);
        } else if (state == 'disconnected') {
            this.iceDisconnectedTimeout = this.options.createTimeout(30 * 1000);
            this.iceDisconnectedTimeout.elapsed().then(() => {
                this.hangup(CallErrorCode.IceFailed);
            }, () => { /* ignore AbortError */ });
        }
    };

    private setState(state: CallState): void {
        const oldState = this._state;
        this._state = state;
        let deferred = this.statePromiseMap.get(state);
        if (deferred) {
            deferred.resolve();
            this.statePromiseMap.delete(state);
        }
        this.options.emitUpdate(this, undefined);
    }

    private waitForState(states: CallState[]): Promise<void> {
        // TODO: rework this, do we need to clean up the promises?
        return Promise.race(states.map(state => {
            let deferred = this.statePromiseMap.get(state);
            if (!deferred) {
                let resolve;
                const promise = new Promise<void>(r => {
                    resolve = r;
                });
                deferred = {resolve, promise};
                this.statePromiseMap.set(state, deferred);
            }
            return deferred.promise;
        }));
    }

    private async terminate(hangupParty: CallParty, hangupReason: CallErrorCode, shouldEmit: boolean): Promise<void> {

    }

    private stopAllMedia(): void {
        if (this.localMedia) {
            for (const track of this.localMedia.tracks) {
                track.stop();
            }
        }
    }

    private async delay(timeoutMs: number): Promise<void> {
        // Allow a short time for initial candidates to be gathered
        const timeout = this.disposables.track(this.options.createTimeout(timeoutMs));
        await timeout.elapsed();
        this.disposables.untrack(timeout);
    }

    public dispose(): void {
        this.disposables.dispose();
        this.peerConnection.dispose();
    }
}



//import { randomString } from '../randomstring';

// null is used as a special value meaning that the we're in a legacy 1:1 call
// without MSC2746 that doesn't provide an id which device sent the message.
type PartyId = string | null;

export enum CallParty {
    Local = 'local',
    Remote = 'remote',
}

export enum CallState {
    Fledgling = 'fledgling',
    CreateOffer = 'create_offer',
    InviteSent = 'invite_sent',
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

//const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export class CallError extends Error {
    code: string;

    constructor(code: CallErrorCode, msg: string, err: Error) {
        // Still don't think there's any way to have proper nested errors
        super(msg + ": " + err);

        this.code = code;
    }
}

export function handlesEventType(eventType: string): boolean {
    return  eventType === EventType.Invite ||
            eventType === EventType.Candidates ||
            eventType === EventType.Answer ||
            eventType === EventType.Hangup;
}

export function tests() {

}
