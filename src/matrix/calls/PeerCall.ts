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

import type {TimeoutCreator, Timeout} from "../../platform/types/types";
import {WebRTC, PeerConnection, PeerConnectionHandler, TrackSender, TrackReceiver} from "../../platform/types/WebRTC";
import {MediaDevices, Track, AudioTrack, Stream} from "../../platform/types/MediaDevices";
import type {LocalMedia} from "./LocalMedia";

import {
    SDPStreamMetadataKey,
    SDPStreamMetadataPurpose,
    EventType,
    CallErrorCode,
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
    forceTURN: boolean,
    turnServers: RTCIceServer[],
    createTimeout: TimeoutCreator,
    emitUpdate: (peerCall: PeerCall, params: any) => void;
    sendSignallingMessage: (message: SignallingMessage<MCallBase>, log: ILogItem) => Promise<void>;
};

export class RemoteMedia {
    constructor(public userMedia?: Stream | undefined, public screenShare?: Stream | undefined) {}
}

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
    // we don't own localMedia and should hence not call dispose on it from here
    private localMedia?: LocalMedia;
    private seq: number = 0;
    // A queue for candidates waiting to go out.
    // We try to amalgamate candidates into a single candidate message where
    // possible
    private candidateSendQueue: Array<RTCIceCandidate> = [];
    // If candidates arrive before we've picked an opponent (which, in particular,
    // will happen if the opponent sends candidates eagerly before the user answers
    // the call) we buffer them up here so we can then add the ones from the party we pick
    private remoteCandidateBuffer? = new Map<PartyId, RTCIceCandidate[]>();

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

    private _dataChannel?: any;
    private _hangupReason?: CallErrorCode;
    private _remoteMedia: RemoteMedia;

    constructor(
        private callId: string,
        private readonly options: Options,
        private readonly logItem: ILogItem,
    ) {
        const outer = this;
        this._remoteMedia = new RemoteMedia();
        this.peerConnection = options.webRTC.createPeerConnection({
            onIceConnectionStateChange(state: RTCIceConnectionState) {
                outer.logItem.wrap({l: "onIceConnectionStateChange", status: state}, log => {
                    outer.onIceConnectionStateChange(state, log);
                });
            },
            onLocalIceCandidate(candidate: RTCIceCandidate) {
                outer.logItem.wrap("onLocalIceCandidate", log => {
                    outer.handleLocalIceCandidate(candidate, log);
                });
            },
            onIceGatheringStateChange(state: RTCIceGatheringState) {
                outer.logItem.wrap({l: "onIceGatheringStateChange", status: state}, log => {
                    outer.handleIceGatheringState(state, log);
                });
            },
            onRemoteStreamRemoved(stream: Stream) {
                outer.logItem.wrap("onRemoteStreamRemoved", log => {
                    outer.updateRemoteMedia(log);
                });
            },
            onRemoteTracksAdded(trackReceiver: TrackReceiver) {
                outer.logItem.wrap("onRemoteTracksAdded", log => {
                    outer.updateRemoteMedia(log);
                });
            },
            onRemoteDataChannel(dataChannel: any | undefined) {
                outer.logItem.wrap("onRemoteDataChannel", log => {
                    outer._dataChannel = dataChannel;
                    outer.options.emitUpdate(outer, undefined);
                });
            },
            onNegotiationNeeded() {
                const promiseCreator = () => {
                    return outer.logItem.wrap("onNegotiationNeeded", log => {
                        return outer.handleNegotiation(log);
                    });
                };
                outer.responsePromiseChain = outer.responsePromiseChain?.then(promiseCreator) ?? promiseCreator();
            }
        }, this.options.forceTURN, this.options.turnServers, 0);
    }

    get dataChannel(): any | undefined { return this._dataChannel; }

    get state(): CallState { return this._state; }

    get hangupReason(): CallErrorCode | undefined { return this._hangupReason; }

    get remoteMedia(): Readonly<RemoteMedia> {
        return this._remoteMedia;
    }

    call(localMedia: LocalMedia): Promise<void> {
        return this.logItem.wrap("call", async log => {
            if (this._state !== CallState.Fledgling) {
                return;
            }
            this.direction = CallDirection.Outbound;
            this.setState(CallState.CreateOffer, log);
            this.updateLocalMedia(localMedia, log);
            if (this.localMedia?.dataChannelOptions) {
                this._dataChannel = this.peerConnection.createDataChannel(this.localMedia.dataChannelOptions);
            }
            // after adding the local tracks, and wait for handleNegotiation to be called,
            // or invite glare where we give up our invite and answer instead
            await this.waitForState([CallState.InviteSent, CallState.CreateAnswer]);
        });
    }

    answer(localMedia: LocalMedia): Promise<void> {
        return this.logItem.wrap("answer", async log => {
            if (this._state !== CallState.Ringing) {
                return;
            }
            this.setState(CallState.CreateAnswer, log);
            this.updateLocalMedia(localMedia, log);
            let myAnswer: RTCSessionDescriptionInit;
            try {
                myAnswer = await this.peerConnection.createAnswer();
            } catch (err) {
                await log.wrap(`Failed to create answer`, log => {
                    log.catch(err);
                    this.terminate(CallParty.Local, CallErrorCode.CreateAnswer, log);
                });
                return;
            }

            try {
                await this.peerConnection.setLocalDescription(myAnswer);
                this.setState(CallState.Connecting, log);
            } catch (err) {
                await log.wrap(`Error setting local description!`, log => {
                    log.catch(err);
                    this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, log);
                });
                return;
            }
            // Allow a short time for initial candidates to be gathered
            try { await this.delay(200); }
            catch (err) { return; }
            await this.sendAnswer(log);
        });
    }

    setMedia(localMedia: LocalMedia): Promise<void> {
        return this.logItem.wrap("setMedia", async log => {
            log.set("userMedia_audio", !!localMedia.userMedia?.audioTrack);
            log.set("userMedia_audio_muted", localMedia.microphoneMuted);
            log.set("userMedia_video", !!localMedia.userMedia?.videoTrack);
            log.set("userMedia_video_muted", localMedia.cameraMuted);
            log.set("screenShare_video", !!localMedia.screenShare?.videoTrack);
            log.set("datachannel", !!localMedia.dataChannelOptions);

            const oldMetaData = this.getSDPMetadata();
            const willRenegotiate = await this.updateLocalMedia(localMedia, log);
            if (!willRenegotiate) {
                const newMetaData = this.getSDPMetadata();
                if (JSON.stringify(oldMetaData) !== JSON.stringify(newMetaData)) {
                    const content: MCallSDPStreamMetadataChanged<MCallBase> = {
                        call_id: this.callId,
                        version: 1,
                        seq: this.seq++,
                        [SDPStreamMetadataKey]: newMetaData
                    };
                    await this.sendSignallingMessage({type: EventType.SDPStreamMetadataChanged, content}, log);
                }
            }
        });
    }

    hangup(errorCode: CallErrorCode): Promise<void> {
        return this.logItem.wrap("hangup", log => {
            return this._hangup(errorCode, log);
        });
    }

    private async _hangup(errorCode: CallErrorCode, log: ILogItem): Promise<void> {
        if (this._state === CallState.Ended) {
            return;
        }
        this.terminate(CallParty.Local, errorCode, log);
        await this.sendHangupWithCallId(this.callId, errorCode, log);
    }

    handleIncomingSignallingMessage<B extends MCallBase>(message: SignallingMessage<B>, partyId: PartyId): Promise<void> {
        return this.logItem.wrap({l: "receive", id: message.type, partyId}, async log => {
            switch (message.type) {
                case EventType.Invite:
                    if (this.callId !== message.content.call_id) {
                        await this.handleInviteGlare(message.content, partyId, log);
                    } else {
                        await this.handleFirstInvite(message.content, partyId, log);
                    }
                    break;
                case EventType.Answer:
                    await this.handleAnswer(message.content, partyId, log);
                    break;
                case EventType.Candidates:
                    await this.handleRemoteIceCandidates(message.content, partyId, log);
                    break;
                case EventType.SDPStreamMetadataChanged:
                case EventType.SDPStreamMetadataChangedPrefix:
                    this.updateRemoteSDPStreamMetadata(message.content[SDPStreamMetadataKey], log);
                    break;
                case EventType.Hangup:
                    // TODO: this is a bit hacky, double check its what we need
                    this.terminate(CallParty.Remote, message.content.reason ?? CallErrorCode.UserHangup, log);
                    break;
                default:
                    log.log(`Unknown event type for call: ${message.type}`);
                    break;
            }
        });
    }

    private sendHangupWithCallId(callId: string, reason: CallErrorCode | undefined, log: ILogItem): Promise<void> {
        const content = {
            call_id: callId,
            version: 1,
            seq: this.seq++,
        };
        // TODO: Don't send UserHangup reason to older clients
        if (reason) {
            content["reason"] = reason;
        }
        return this.sendSignallingMessage({
            type: EventType.Hangup,
            content
        }, log);
    }

    // calls are serialized and deduplicated by responsePromiseChain
    private handleNegotiation = async (log: ILogItem): Promise<void> => {
        this.makingOffer = true;
        try {
            try {
                await this.peerConnection.setLocalDescription();
            } catch (err) {
                log.log(`Error setting local description!`).catch(err);
                this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, log);
                return;
            }

            if (this.peerConnection.iceGatheringState === 'gathering') {
                // Allow a short time for initial candidates to be gathered
                try { await this.delay(200); }
                catch (err) { return; }
            }

            if (this._state === CallState.Ended) {
                return;
            }

            const offer = this.peerConnection.localDescription!;
            // Get rid of any candidates waiting to be sent: they'll be included in the local
            // description we just got and will send in the offer.
            log.log(`Discarding ${
                this.candidateSendQueue.length} candidates that will be sent in offer`);
            this.candidateSendQueue = [];

            // need to queue this
            const content = {
                call_id: this.callId,
                offer,
                [SDPStreamMetadataKey]: this.getSDPMetadata(),
                version: 1,
                seq: this.seq++,
                lifetime: CALL_TIMEOUT_MS
            };
            if (this._state === CallState.CreateOffer) {
                await this.sendSignallingMessage({type: EventType.Invite, content}, log);
                this.setState(CallState.InviteSent, log);
            } else if (this._state === CallState.Connected || this._state === CallState.Connecting) {
                log.log("would send renegotiation now but not implemented");
                // send Negotiate message
                //await this.sendSignallingMessage({type: EventType.Invite, content});
                //this.setState(CallState.InviteSent);
            }
        } finally {
            this.makingOffer = false;
        }

        this.sendCandidateQueue(log);

        await log.wrap("invite timeout", async log => {
            if (this._state === CallState.InviteSent) {
                try { await this.delay(CALL_TIMEOUT_MS); }
                catch (err) { return; }
                // @ts-ignore TS doesn't take the await above into account to know that the state could have changed in between
                if (this._state === CallState.InviteSent) {
                    this._hangup(CallErrorCode.InviteTimeout, log);
                }
            }
        });
    };

    private async handleInviteGlare(content: MCallInvite<MCallBase>, partyId: PartyId, log: ILogItem): Promise<void> {
        // this is only called when the ids are different
        const newCallId = content.call_id;
        if (this.callId! > newCallId) {
            log.log(
                "Glare detected: answering incoming call " + newCallId +
                " and canceling outgoing call ",
            );
            // How do we interrupt `call()`? well, perhaps we need to not just await InviteSent but also CreateAnswer?
            if (this._state === CallState.Fledgling || this._state === CallState.CreateOffer) {
                // TODO: don't send invite!
            } else {
                await this.sendHangupWithCallId(this.callId, CallErrorCode.Replaced, log);
            }
            await this.handleInvite(content, partyId, log);
            // TODO: need to skip state check
            await this.answer(this.localMedia!);
        } else {
            log.log(
                "Glare detected: rejecting incoming call " + newCallId +
                " and keeping outgoing call ",
            );
            await this.sendHangupWithCallId(newCallId, CallErrorCode.Replaced, log);
        }
    }

    private handleHangupReceived(content: MCallHangupReject<MCallBase>, log: ILogItem) {
        // party ID must match (our chosen partner hanging up the call) or be undefined (we haven't chosen
        // a partner yet but we're treating the hangup as a reject as per VoIP v0)
        // if (this.state === CallState.Ringing) {
            // default reason is user_hangup
        this.terminate(CallParty.Remote, content.reason || CallErrorCode.UserHangup, log);
        // } else {
        //     log.set("ignored", true);
        // }
    };

    private async handleFirstInvite(content: MCallInvite<MCallBase>, partyId: PartyId, log: ILogItem): Promise<void> {
        if (this._state !== CallState.Fledgling || this.opponentPartyId !== undefined) {
            // TODO: hangup or ignore?
            return;
        }
        await this.handleInvite(content, partyId, log);
    }

    private async handleInvite(content: MCallInvite<MCallBase>, partyId: PartyId, log: ILogItem): Promise<void> {

        // we must set the party ID before await-ing on anything: the call event
        // handler will start giving us more call events (eg. candidates) so if
        // we haven't set the party ID, we'll ignore them.
        this.opponentPartyId = partyId;
        this.direction = CallDirection.Inbound;

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata, log);
        } else {
            log.log(`Call did not get any SDPStreamMetadata! Can not send/receive multiple streams`);
        }

        try {
            // Q: Why do we set the remote description before accepting the call? To start creating ICE candidates?
            await this.peerConnection.setRemoteDescription(content.offer);
            await this.addBufferedIceCandidates(log);
        } catch (e) {
            await log.wrap(`Call failed to set remote description`, async log => {
                log.catch(e);
                return this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, log);
            });
            return;
        }

        // According to previous comments in this file, firefox at some point did not
        // add streams until media started arriving on them. Testing latest firefox
        // (81 at time of writing), this is no longer a problem, so let's do it the correct way.
        if (this.peerConnection.remoteStreams.size === 0) {
            await log.wrap(`Call no remote stream or no tracks after setting remote description!`, async log => {
                return this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, log);
            });
            return;
        }

        this.setState(CallState.Ringing, log);

        try { await this.delay(content.lifetime ?? CALL_TIMEOUT_MS); }
        catch (err) { return; }
        // @ts-ignore TS doesn't take the await above into account to know that the state could have changed in between
        if (this._state === CallState.Ringing) {
            log.log(`Invite has expired. Hanging up.`);
            this.hangupParty = CallParty.Remote; // effectively
            this.setState(CallState.Ended, log);
            //this.localMedia?.dispose();
            //this.localMedia = undefined;
            if (this.peerConnection.signalingState != 'closed') {
                this.peerConnection.close();
            }
        }
    }

    private async handleAnswer(content: MCallAnswer<MCallBase>, partyId: PartyId, log: ILogItem): Promise<void> {
        if (this._state === CallState.Ended) {
            log.log(`Ignoring answer because call has ended`);
            return;
        }

        if (this.opponentPartyId !== undefined) {
            log.log(`Ignoring answer: we already have an answer/reject from ${this.opponentPartyId}`);
            return;
        }

        this.opponentPartyId = partyId;
        await this.addBufferedIceCandidates(log);

        this.setState(CallState.Connecting, log);

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata, log);
        } else {
            log.log(`Did not get any SDPStreamMetadata! Can not send/receive multiple streams`);
        }

        try {
            await this.peerConnection.setRemoteDescription(content.answer);
        } catch (e) {
            await log.wrap(`Failed to set remote description`, log => {
                log.catch(e);
                this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, log);
            });
            return;
        }
    }

    private handleIceGatheringState(state: RTCIceGatheringState, log: ILogItem) {
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
            this.queueCandidate(c, log);
            this.sentEndOfCandidates = true;
        }
    }

    private handleLocalIceCandidate(candidate: RTCIceCandidate, log: ILogItem) {
        log.set("sdpMid", candidate.sdpMid);
        log.set("candidate", candidate.candidate);

        if (this._state === CallState.Ended) {
            return;
        }
        // As with the offer, note we need to make a copy of this object, not
        // pass the original: that broke in Chrome ~m43.
        if (candidate.candidate !== '' || !this.sentEndOfCandidates) {
            this.queueCandidate(candidate, log);
            if (candidate.candidate === '') {
                this.sentEndOfCandidates = true;
            }
        }
    }

    private async handleRemoteIceCandidates(content: MCallCandidates<MCallBase>, partyId: PartyId, log: ILogItem) {
        if (this.state === CallState.Ended) {
            log.log("Ignoring remote ICE candidate because call has ended");
            return;
        }

        const candidates = content.candidates;
        if (!candidates) {
            log.log(`Ignoring candidates event with no candidates!`);
            return;
        }

        const fromPartyId = content.version === 0 ? null : partyId || null;

        if (this.opponentPartyId === undefined) {
            // we haven't picked an opponent yet so save the candidates
            log.log(`Buffering ${candidates.length} candidates until we pick an opponent`);
            const bufferedCandidates = this.remoteCandidateBuffer!.get(fromPartyId) || [];
            bufferedCandidates.push(...candidates);
            this.remoteCandidateBuffer!.set(fromPartyId, bufferedCandidates);
            return;
        }

        if (this.opponentPartyId !== partyId) {
            log.log(
                `Ignoring candidates from party ID ${partyId}: ` +
                `we have chosen party ID ${this.opponentPartyId}`,
            );

            return;
        }

        await this.addIceCandidates(candidates, log);
    }

    // private async onNegotiateReceived(event: MatrixEvent): Promise<void> {
    //     const content = event.getContent<MCallNegotiate>();
    //     const description = content.description;
    //     if (!description || !description.sdp || !description.type) {
    //         this.logger.info(`Ignoring invalid m.call.negotiate event`);
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
    //         this.logger.info(`Ignoring colliding negotiate event because we're impolite`);
    //         return;
    //     }

    //     const sdpStreamMetadata = content[SDPStreamMetadataKey];
    //     if (sdpStreamMetadata) {
    //         this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
    //     } else {
    //         this.logger.warn(`Received negotiation event without SDPStreamMetadata!`);
    //     }

    //     try {
    //         await this.peerConnection.setRemoteDescription(description);

    //         if (description.type === 'offer') {
    //             await this.peerConnection.setLocalDescription();
    //             await this.sendSignallingMessage({
    //                 type: EventType.CallNegotiate,
    //                 content: {
    //                     description: this.peerConnection.localDescription!,
    //                     [SDPStreamMetadataKey]: this.getSDPMetadata(),
    //                 }
    //             });
    //         }
    //     } catch (err) {
    //         this.logger.warn(`Failed to complete negotiation`, err);
    //     }
    // }

    private async sendAnswer(log: ILogItem): Promise<void> {
        const localDescription = this.peerConnection.localDescription!;
        const answerContent: MCallAnswer<MCallBase> = {
            call_id: this.callId,
            version: 1,
            seq: this.seq++,
            answer: {
                sdp: localDescription.sdp,
                type: localDescription.type,
            },
            [SDPStreamMetadataKey]: this.getSDPMetadata(),
        };

        // We have just taken the local description from the peerConn which will
        // contain all the local candidates added so far, so we can discard any candidates
        // we had queued up because they'll be in the answer.
        log.log(`Discarding ${
            this.candidateSendQueue.length} candidates that will be sent in answer`);
        this.candidateSendQueue = [];

        try {
            await this.sendSignallingMessage({type: EventType.Answer, content: answerContent}, log);
        } catch (error) {
            this.terminate(CallParty.Local, CallErrorCode.SendAnswer, log);
            throw error;
        }

        // error handler re-throws so this won't happen on error, but
        // we don't want the same error handling on the candidate queue
        this.sendCandidateQueue(log);
    }

    private queueCandidate(content: RTCIceCandidate, log: ILogItem): void {
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
        const sendLogItem = this.logItem.child("wait to send candidates");
        log.refDetached(sendLogItem);
        this.delay(this.direction === CallDirection.Inbound ? 500 : 2000)
            .then(() => {
                return this.sendCandidateQueue(sendLogItem);
            }, err => {}) // swallow delay AbortError
            .finally(() => {
                sendLogItem.finish();
            });
    }

    private async sendCandidateQueue(log: ILogItem): Promise<void> {
        return log.wrap("send candidates queue", async log => {
            log.set("queueLength", this.candidateSendQueue.length);

            if (this.candidateSendQueue.length === 0 || this._state === CallState.Ended) {
                return;
            }

            const candidates = this.candidateSendQueue;
            this.candidateSendQueue = [];
            try {
                await this.sendSignallingMessage({
                    type: EventType.Candidates,
                    content: {
                        call_id: this.callId,
                        version: 1,
                        seq: this.seq++,
                        candidates
                    },
                }, log);
                // Try to send candidates again just in case we received more candidates while sending.
                this.sendCandidateQueue(log);
            } catch (error) {
                log.catch(error);
                // don't retry this event: we'll send another one later as we might
                // have more candidates by then.
                // put all the candidates we failed to send back in the queue

                // TODO: terminate doesn't seem to vibe with the comment above?
                this.terminate(CallParty.Local, CallErrorCode.SignallingFailed, log);
            }
        });
    }

    private updateRemoteSDPStreamMetadata(metadata: SDPStreamMetadata, log: ILogItem): void {
        // this will accumulate all updates into one object, so we still have the old stream info when we change stream id
        this.remoteSDPStreamMetadata = recursivelyAssign(this.remoteSDPStreamMetadata || {}, metadata, true);
        this.updateRemoteMedia(log);
        
    }

    private async addBufferedIceCandidates(log: ILogItem): Promise<void> {
        if (this.remoteCandidateBuffer && this.opponentPartyId) {
            const bufferedCandidates = this.remoteCandidateBuffer.get(this.opponentPartyId);
            if (bufferedCandidates) {
                log.log(`Adding ${
                    bufferedCandidates.length} buffered candidates for opponent ${this.opponentPartyId}`);
                await this.addIceCandidates(bufferedCandidates, log);
            }
            this.remoteCandidateBuffer = undefined;
        }
    }

    private async addIceCandidates(candidates: RTCIceCandidate[], log: ILogItem): Promise<void> {
        for (const candidate of candidates) {
            if (
                (candidate.sdpMid === null || candidate.sdpMid === undefined) &&
                (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined)
            ) {
                log.log(`Ignoring remote ICE candidate with no sdpMid or sdpMLineIndex`);
                continue;
            }
            log.log(`Got remote ICE ${candidate.sdpMid} candidate: ${candidate.candidate}`);
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                if (!this.ignoreOffer) {
                    log.log(`Failed to add remote ICE candidate`, err);
                }
            }
        }
    }

    private onIceConnectionStateChange = (state: RTCIceConnectionState, log: ILogItem): void => {
        if (this._state === CallState.Ended) {
            return; // because ICE can still complete as we're ending the call
        }
        // ideally we'd consider the call to be connected when we get media but
        // chrome doesn't implement any of the 'onstarted' events yet
        if (state == 'connected') {
            this.iceDisconnectedTimeout?.abort();
            this.iceDisconnectedTimeout = undefined;
            this.setState(CallState.Connected, log);
        } else if (state == 'failed') {
            this.iceDisconnectedTimeout?.abort();
            this.iceDisconnectedTimeout = undefined;
            this._hangup(CallErrorCode.IceFailed, log);
        } else if (state == 'disconnected') {
            this.iceDisconnectedTimeout = this.options.createTimeout(30 * 1000);
            this.iceDisconnectedTimeout.elapsed().then(() => {
                this._hangup(CallErrorCode.IceFailed, log);
            }, () => { /* ignore AbortError */ });
        }
    };

    private setState(state: CallState, log: ILogItem): void {
        if (state !== this._state) {
            log.log({l: "change state", status: state, oldState: this._state});
            const oldState = this._state;
            this._state = state;
            let deferred = this.statePromiseMap.get(state);
            if (deferred) {
                deferred.resolve();
                this.statePromiseMap.delete(state);
            }
            this.options.emitUpdate(this, undefined);
        }
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

    private terminate(hangupParty: CallParty, hangupReason: CallErrorCode, log: ILogItem): void {
        if (this._state === CallState.Ended) {
            return;
        }

        this.hangupParty = hangupParty;
        this._hangupReason = hangupReason;
        this.setState(CallState.Ended, log);
        this.localMedia = undefined;

        if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
            this.peerConnection.close();
        }
    }

    private getSDPMetadata(): SDPStreamMetadata {
        const metadata = {};
        if (this.localMedia?.userMedia) {
            const streamId = this.localMedia.userMedia.id;
            const streamSender = this.peerConnection.localStreams.get(streamId);
            metadata[streamId] = {
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audio_muted: !(streamSender?.audioSender?.enabled && streamSender?.audioSender?.track?.enabled),
                video_muted: !(streamSender?.videoSender?.enabled && streamSender?.videoSender?.track?.enabled),
            };
        }
        if (this.localMedia?.screenShare) {
            const streamId = this.localMedia.screenShare.id;
            metadata[streamId] = {
                purpose: SDPStreamMetadataPurpose.Screenshare
            };
        }
        return metadata;
    }

    private updateRemoteMedia(log: ILogItem) {
        this._remoteMedia.userMedia = undefined;
        this._remoteMedia.screenShare = undefined;
        if (this.remoteSDPStreamMetadata) {
            for (const [streamId, streamReceiver] of this.peerConnection.remoteStreams.entries()) {
                const metaData = this.remoteSDPStreamMetadata[streamId];
                if (metaData) {
                    if (metaData.purpose === SDPStreamMetadataPurpose.Usermedia) {
                        this._remoteMedia.userMedia = streamReceiver.stream;
                        streamReceiver.audioReceiver?.enable(!metaData.audio_muted);
                        streamReceiver.videoReceiver?.enable(!metaData.video_muted);
                    } else if (metaData.purpose === SDPStreamMetadataPurpose.Screenshare) {
                        this._remoteMedia.screenShare = streamReceiver.stream;
                    }
                }
            }
        }
        this.options.emitUpdate(this, undefined);
    }

    private updateLocalMedia(localMedia: LocalMedia, logItem: ILogItem): Promise<boolean> {
        return logItem.wrap("updateLocalMedia", async log => {
            let willRenegotiate = false;
            const oldMedia = this.localMedia;
            this.localMedia = localMedia;
            const applyStream = async (oldStream: Stream | undefined, stream: Stream | undefined, oldMuteSettings: LocalMedia | undefined, mutedSettings: LocalMedia | undefined, logLabel: string) => {
                const streamSender = oldStream ? this.peerConnection.localStreams.get(oldStream.id) : undefined;

                const applyTrack = async (oldTrack: Track | undefined, sender: TrackSender | undefined, track: Track | undefined, wasMuted: boolean | undefined, muted: boolean | undefined) => {
                    const changed = (!track && oldTrack) ||
                        (track && !oldTrack) ||
                        (track && oldTrack && !track.equals(oldTrack));
                    if (changed) {
                        if (track) {
                            if (oldTrack && sender && !track.equals(oldTrack)) {
                                try {
                                    await log.wrap(`replacing ${logLabel} ${track.kind} track`, log => {
                                        return sender.replaceTrack(track);
                                    });
                                } catch (err) {
                                    // can't replace the track without renegotiating
                                    log.wrap(`adding and removing ${logLabel} ${track.kind} track`, log => {
                                        this.peerConnection.removeTrack(sender);
                                        this.peerConnection.addTrack(track);
                                        willRenegotiate = true;
                                    });
                                }
                            } else {
                                log.wrap(`adding ${logLabel} ${track.kind} track`, log => {
                                    this.peerConnection.addTrack(track);
                                    willRenegotiate = true;
                                });
                            }
                        } else {
                            if (sender) {
                                // this will be used for muting, do we really want to trigger renegotiation here?
                                // we want to disable the sender, but also remove the track as we don't want to keep
                                // using the webcam if we don't need to
                                log.wrap(`removing ${logLabel} ${sender.track.kind} track`, log => {
                                    sender.track.enabled = false;
                                    this.peerConnection.removeTrack(sender);
                                    willRenegotiate = true;
                                });
                            }
                        }
                    } else if (track) {
                        console.log({muted, wasMuted, wasCameraMuted: oldMedia?.cameraMuted});
                        if (sender && muted !== wasMuted) {
                            // TODO: why does unmuting not work? wasMuted is false
                            log.wrap(`${logLabel} ${track.kind} ${muted ? "muting" : "unmuting"}`, log => {
                                sender.track.enabled = !muted;
                                sender.enable(!muted);
                                willRenegotiate = true;
                            });
                        } else {
                            log.log(`${logLabel} ${track.kind} track hasn't changed`);
                        }
                    }
                }

                await applyTrack(oldStream?.audioTrack, streamSender?.audioSender, stream?.audioTrack, oldMuteSettings?.microphoneMuted, mutedSettings?.microphoneMuted);
                await applyTrack(oldStream?.videoTrack, streamSender?.videoSender, stream?.videoTrack, oldMuteSettings?.cameraMuted, mutedSettings?.cameraMuted);
            }

            await applyStream(oldMedia?.userMedia, localMedia?.userMedia, oldMedia, localMedia, "userMedia");
            applyStream(oldMedia?.screenShare, localMedia?.screenShare, undefined, undefined, "screenShare");
            return willRenegotiate;
            // TODO: datachannel, but don't do it here as we don't want to do it from answer, rather in different method
        });
    }

    private async delay(timeoutMs: number): Promise<void> {
        // Allow a short time for initial candidates to be gathered
        const timeout = this.disposables.track(this.options.createTimeout(timeoutMs));
        await timeout.elapsed();
        this.disposables.untrack(timeout);
    }

    private sendSignallingMessage(message: SignallingMessage<MCallBase>, log: ILogItem) {
        return log.wrap({l: "send", id: message.type}, async log => {
            return this.options.sendSignallingMessage(message, log);
        });
    }

    public dispose(): void {
        this.disposables.dispose();
        this.peerConnection.dispose();
    }

    public close(reason: CallErrorCode | undefined, log: ILogItem): void {
        if (reason === undefined) {
            reason = CallErrorCode.UserHangup;
        }
        this.terminate(CallParty.Local, reason, log);
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

/**
 * The version field that we set in m.call.* events
 */
const VOIP_PROTO_VERSION = 1;

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
            eventType === EventType.Hangup ||
            eventType === EventType.SDPStreamMetadataChanged ||
            eventType === EventType.SDPStreamMetadataChangedPrefix ||
            eventType === EventType.Negotiate;
}

export function tests() {

}
