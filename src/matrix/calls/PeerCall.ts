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

import {ObservableMap} from "../../observable/map";
import {BaseObservableValue} from "../../observable/value";
import {recursivelyAssign} from "../../utils/recursivelyAssign";
import {Disposables, Disposable, IDisposable} from "../../utils/Disposables";
import {WebRTC, PeerConnection, Transceiver, TransceiverDirection, Sender, Receiver, PeerConnectionEventMap} from "../../platform/types/WebRTC";
import {MediaDevices, Track, TrackKind, Stream, StreamTrackEvent} from "../../platform/types/MediaDevices";
import {getStreamVideoTrack, getStreamAudioTrack, MuteSettings, mute} from "./common";
import {
    SDPStreamMetadataKey,
    SDPStreamMetadataPurpose,
    EventType,
    CallErrorCode,
} from "./callEventTypes";

import type {Room} from "../room/Room";
import type {StateEvent} from "../storage/types";
import type {ILogItem} from "../../logging/types";
import type {TimeoutCreator, Timeout} from "../../platform/types/types";
import type {LocalMedia} from "./LocalMedia";
import type {
    MCallBase,
    MCallInvite,
    MCallNegotiate,
    MCallAnswer,
    MCallSDPStreamMetadataChanged,
    MCallCandidates,
    MCallHangupReject,
    SDPStreamMetadata,
    SignallingMessage
} from "./callEventTypes";
import type { ErrorBoundary } from "../../utils/ErrorBoundary";
import { AbortError } from "../../utils/error";

export type Options = {
    webRTC: WebRTC,
    forceTURN: boolean,
    turnServer: BaseObservableValue<RTCIceServer>,
    createTimeout: TimeoutCreator,
    emitUpdate: (peerCall: PeerCall, params: any, log: ILogItem) => void;
    errorBoundary: ErrorBoundary; 
    sendSignallingMessage: (message: SignallingMessage<MCallBase>, log: ILogItem) => Promise<void>;
};

export enum IncomingMessageAction {
    InviteGlare,
    Handle,
    Ignore
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
    private localMuteSettings?: MuteSettings;
    // TODO: this should go in member
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
    private _remoteTrackToStreamId = new Map<string, string>();
    private _remoteStreams = new Map<string, {stream: Stream, disposeListener: Disposable}>();
    // perfect negotiation flags
    private makingOffer: boolean = false;
    private ignoreOffer: boolean = false;

    private sentEndOfCandidates: boolean = false;
    private iceDisconnectedTimeout?: Timeout;

    private _dataChannel?: any;
    private _hangupReason?: CallErrorCode;
    private _remoteMedia: RemoteMedia;
    private _remoteMuteSettings = new MuteSettings();
    private flushCandidatesLog?: ILogItem;
    
    constructor(
        private callId: string,
        private readonly options: Options,
        private readonly logItem: ILogItem,
    ) {
        logItem.log({l: "create PeerCall", id: callId});
        this._remoteMedia = new RemoteMedia();
        this.peerConnection = options.webRTC.createPeerConnection(
            this.options.forceTURN,
            [this.options.turnServer.get()],
            0
        );
        // update turn servers when they change (see TurnServerSource)
        this.disposables.track(this.options.turnServer.subscribe(turnServer => {
            this.logItem.log({l: "updating turn server", turnServer})
            this.peerConnection.setConfiguration({iceServers: [turnServer]});
        }));
        const listen = <K extends keyof PeerConnectionEventMap>(type: K, listener: (ev: PeerConnectionEventMap[K]) => any, options?: boolean | EventListenerOptions): void => {
            const newListener = (e) => {
                this.options.errorBoundary.try(() => listener(e));
            };
            this.peerConnection.addEventListener(type, newListener);
            const dispose = () => {
                this.peerConnection.removeEventListener(type, newListener);
            };
            this.disposables.track(dispose);
        };

        listen("iceconnectionstatechange", async () => {
            const state = this.peerConnection.iceConnectionState;
            await logItem.wrap({l: "onIceConnectionStateChange", status: state}, async log => {
                await this.onIceConnectionStateChange(state, log);
            });
        });
        listen("icecandidate", async (event) => {
            await logItem.wrap("onLocalIceCandidate", async log => {
                if (event.candidate) {
                    await this.handleLocalIceCandidate(event.candidate, log);
                }
            });
        });
        listen("icegatheringstatechange", async () => {
            const state = this.peerConnection.iceGatheringState;
            await logItem.wrap({l: "onIceGatheringStateChange", status: state}, async log => {
                await this.handleIceGatheringState(state, log);
            });
        });
        listen("track", event => {
            logItem.wrap("onRemoteTrack", log => {
                this.onRemoteTrack(event.track, event.streams, log);
            });
        });
        listen("datachannel", event => {
            logItem.wrap("onRemoteDataChannel", log => {
                this._dataChannel = event.channel;
                this.options.emitUpdate(this, undefined, log);
            });
        });
        listen("negotiationneeded", () => {
            const signalingState = this.peerConnection.signalingState;
            const promiseCreator = () => {
                return logItem.wrap({l: "onNegotiationNeeded", signalingState}, log => {
                    return this.handleNegotiation(log);
                });
            };
            this.responsePromiseChain = this.responsePromiseChain?.then(promiseCreator) ?? promiseCreator();
            this.responsePromiseChain.catch((e) =>
                this.options.errorBoundary.reportError(e)
            );
        });
    }

    get dataChannel(): any | undefined { return this._dataChannel; }

    get state(): CallState { return this._state; }

    get hangupReason(): CallErrorCode | undefined { return this._hangupReason; }

    get remoteMedia(): Readonly<RemoteMedia> {
        return this._remoteMedia;
    }

    get remoteMuteSettings(): MuteSettings {
        return this._remoteMuteSettings;
    }

    call(localMedia: LocalMedia, localMuteSettings: MuteSettings, log: ILogItem): Promise<void> {
        return log.wrap("call", async log => {
            if (this._state !== CallState.Fledgling) {
                return;
            }
            log.set("signalingState", this.peerConnection.signalingState);
            this.direction = CallDirection.Outbound;
            this.setState(CallState.CreateOffer, log);
            this.localMuteSettings = localMuteSettings;
            await this.updateLocalMedia(localMedia, log);
            if (this.localMedia?.dataChannelOptions) {
                this._dataChannel = this.peerConnection.createDataChannel("channel", this.localMedia.dataChannelOptions);
            }
            // after adding the local tracks, and wait for handleNegotiation to be called,
            // or invite glare where we give up our invite and answer instead
            // TODO: we don't actually use this
            await this.waitForState([CallState.InviteSent, CallState.CreateAnswer]);
        });
    }

    answer(localMedia: LocalMedia, localMuteSettings: MuteSettings, log: ILogItem): Promise<void> {
        return log.wrap("answer", async log => {
            if (this._state !== CallState.Ringing) {
                return;
            }
            this.setState(CallState.CreateAnswer, log);
            this.localMuteSettings = localMuteSettings;
            await this.updateLocalMedia(localMedia, log);
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

    setMedia(localMedia: LocalMedia, log: ILogItem): Promise<void> {
        return log.wrap("setMedia", async log => {
            log.set("userMedia_audio", !!getStreamAudioTrack(localMedia.userMedia));
            log.set("userMedia_video", !!getStreamVideoTrack(localMedia.userMedia));
            log.set("screenShare_video", !!getStreamVideoTrack(localMedia.screenShare));
            log.set("datachannel", !!localMedia.dataChannelOptions);
            await this.updateLocalMedia(localMedia, log);
            const content: MCallSDPStreamMetadataChanged<MCallBase> = {
                call_id: this.callId,
                version: 1,
                [SDPStreamMetadataKey]: this.getSDPMetadata()
            };
            await this.sendSignallingMessage({type: EventType.SDPStreamMetadataChangedPrefix, content}, log);
        });
    }

    setMuted(localMuteSettings: MuteSettings, log: ILogItem): Promise<void> {
        return log.wrap("setMuted", async log => {
            this.localMuteSettings = localMuteSettings;
            log.set("cameraMuted", localMuteSettings.camera);
            log.set("microphoneMuted", localMuteSettings.microphone);

            if (this.localMedia) {
                mute(this.localMedia, localMuteSettings, log);
                const content: MCallSDPStreamMetadataChanged<MCallBase> = {
                    call_id: this.callId,
                    version: 1,
                    [SDPStreamMetadataKey]: this.getSDPMetadata()
                };
                await this.sendSignallingMessage({type: EventType.SDPStreamMetadataChangedPrefix, content}, log);
            }
        });
    }

    hangup(errorCode: CallErrorCode, log: ILogItem): Promise<void> {
        return log.wrap("hangup", log => {
            return this._hangup(errorCode, log);
        });
    }

    private async _hangup(errorCode: CallErrorCode, log: ILogItem): Promise<void> {
        if (this._state === CallState.Ended || this._state === CallState.Ending) {
            return;
        }
        this.setState(CallState.Ending, log);
        await this.sendHangupWithCallId(this.callId, errorCode, log);
        this.terminate(CallParty.Local, errorCode, log);
    }

    getMessageAction<B extends MCallBase>(message: SignallingMessage<B>): IncomingMessageAction {
        const callIdMatches = this.callId === message.content.call_id;
        if (message.type === EventType.Invite && !callIdMatches) {
            return IncomingMessageAction.InviteGlare;
        } if (callIdMatches) {
            return IncomingMessageAction.Handle;
        } else {
            return IncomingMessageAction.Ignore;
        }
    }

    handleIncomingSignallingMessage<B extends MCallBase>(message: SignallingMessage<B>, partyId: PartyId, log: ILogItem): ILogItem {
        // return logItem item immediately so it can be referenced by the sync log
        let logItem;
        log.wrap({
            l: "receive signalling message",
            type: message.type,
            callId: message.content.call_id,
            payload: message.content
        }, async log => {
            logItem = log;
            if (this.getMessageAction(message) !== IncomingMessageAction.Handle) {
                log.set("wrongCallId", true);
                return;
            }
            switch (message.type) {
                case EventType.Invite:
                    await this.handleFirstInvite(message.content, partyId, log);
                    break;
                case EventType.Answer:
                    await this.handleAnswer(message.content, partyId, log);
                    break;
                case EventType.Negotiate:
                    await this.onNegotiateReceived(message.content, log);
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
                    log.set("reason", message.content.reason);
                    this.terminate(CallParty.Remote, message.content.reason ?? CallErrorCode.UserHangup, log);
                    break;
                default:
                    log.log(`Unknown event type for call: ${message.type}`);
                    break;
            }
        });
        return logItem;
    }

    private sendHangupWithCallId(callId: string, reason: CallErrorCode | undefined, log: ILogItem): Promise<void> {
        const content = {
            call_id: callId,
            version: 1,
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
    private async handleNegotiation(log: ILogItem): Promise<void> {
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
            log.set("includedCandidates", this.candidateSendQueue.length);
            this.candidateSendQueue = [];

            // need to queue this
            if (this._state === CallState.CreateOffer) {
                const content = {
                    call_id: this.callId,
                    offer,
                    [SDPStreamMetadataKey]: this.getSDPMetadata(),
                    version: 1,
                    lifetime: CALL_TIMEOUT_MS
                };
                await this.sendSignallingMessage({type: EventType.Invite, content}, log);
                this.setState(CallState.InviteSent, log);
            } else if (this._state === CallState.Connected || this._state === CallState.Connecting) {
                const content = {
                    call_id: this.callId,
                    description: offer,
                    [SDPStreamMetadataKey]: this.getSDPMetadata(),
                    version: 1,
                    lifetime: CALL_TIMEOUT_MS
                };
                await this.sendSignallingMessage({type: EventType.Negotiate, content}, log);
            }
        } finally {
            this.makingOffer = false;
        }

        this.sendCandidateQueue(log);

        if (this._state === CallState.InviteSent) {
            const timeoutLog = this.logItem.child("invite timeout");
            log.refDetached(timeoutLog);
            // don't await this, as it would block other negotationneeded events from being processed
            // as they are processed serially
            await timeoutLog.run(async log => {
                try { await this.delay(CALL_TIMEOUT_MS); }
                catch (err) { return; } // return when delay is cancelled by throwing an AbortError
                // @ts-ignore TS doesn't take the await above into account to know that the state could have changed in between
                if (this._state === CallState.InviteSent) {
                    await this._hangup(CallErrorCode.InviteTimeout, log);
                }
            });
        }
    };

    /**
     * @returns {boolean} whether or not this call should be replaced
     * */
    handleInviteGlare<B extends MCallBase>(message: SignallingMessage<B>, partyId: PartyId, log: ILogItem): {shouldReplace: boolean, log?: ILogItem} {
        if (message.type !== EventType.Invite) {
            return {shouldReplace: false};
        }

        const {content} = message;
        const newCallId = content.call_id;
        const shouldReplace = this.callId! > newCallId;

        let logItem;
        log.wrap("handling call glare", async log => {
            logItem = log;
            if (shouldReplace) {
                log.log(
                    "Glare detected: answering incoming call " + newCallId +
                    " and canceling outgoing call "
                );
                // TODO: How do we interrupt `call()`? well, perhaps we need to not just await InviteSent but also CreateAnswer?
                if (this._state !== CallState.Fledgling && this._state !== CallState.CreateOffer) {
                    await this.sendHangupWithCallId(this.callId, CallErrorCode.Replaced, log);
                }
                // since this method isn't awaited, we dispose ourselves once we hung up
                this.close(CallErrorCode.Replaced, log);
                this.dispose();
            } else {
                log.log(
                    "Glare detected: rejecting incoming call " + newCallId +
                    " and keeping outgoing call "
                );
                await this.sendHangupWithCallId(newCallId, CallErrorCode.Replaced, log);
            }
        });

        return {shouldReplace, log: logItem};
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
        if (this.peerConnection.getReceivers().length === 0) {
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

    private async handleIceGatheringState(state: RTCIceGatheringState, log: ILogItem) {
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
            await this.queueCandidate(c, log);
            this.sentEndOfCandidates = true;
        }
    }

    private async handleLocalIceCandidate(candidate: RTCIceCandidate, log: ILogItem) {
        log.set("sdpMid", candidate.sdpMid);
        log.set("candidate", candidate.candidate);

        if (this._state === CallState.Ended) {
            return;
        }
        // As with the offer, note we need to make a copy of this object, not
        // pass the original: that broke in Chrome ~m43.
        if (candidate.candidate !== '' || !this.sentEndOfCandidates) {
            await this.queueCandidate(candidate, log);
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
                `we have chosen party ID ${this.opponentPartyId}`
            );

            return;
        }

        await this.addIceCandidates(candidates, log);
    }

    private async onNegotiateReceived(content: MCallNegotiate<MCallBase>, log: ILogItem): Promise<void> {
        const description = content.description;
        if (!description || !description.sdp || !description.type) {
            log.log(`Ignoring invalid m.call.negotiate event`);
            return;
        }
        // Politeness always follows the direction of the call: in a glare situation,
        // we pick either the inbound or outbound call, so one side will always be
        // inbound and one outbound
        const polite = this.direction === CallDirection.Inbound;

        // Here we follow the perfect negotiation logic from
        // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
        const offerCollision = (
            (description.type === 'offer') &&
            (this.makingOffer || this.peerConnection.signalingState !== 'stable')
        );

        this.ignoreOffer = !polite && offerCollision;
        if (this.ignoreOffer) {
            log.log(`Ignoring colliding negotiate event because we're impolite`);
            return;
        }

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata, log);
        } else {
            log.log(`Received negotiation event without SDPStreamMetadata!`);
        }

        try {
            await this.peerConnection.setRemoteDescription(description);
            if (description.type === 'offer') {
                await this.peerConnection.setLocalDescription();
                const content = {
                    call_id: this.callId,
                    description: this.peerConnection.localDescription!,
                    [SDPStreamMetadataKey]: this.getSDPMetadata(),
                    version: 1,
                    lifetime: CALL_TIMEOUT_MS
                };
                await this.sendSignallingMessage({type: EventType.Negotiate, content}, log);
            }
        } catch (err) {
            log.log(`Failed to complete negotiation`).catch(err);
        }
    }

    private async sendAnswer(log: ILogItem): Promise<void> {
        const localDescription = this.peerConnection.localDescription!;
        const answerContent: MCallAnswer<MCallBase> = {
            call_id: this.callId,
            version: 1,
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

    private async queueCandidate(content: RTCIceCandidate, log: ILogItem): Promise<void> {
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


        this.flushCandidatesLog = this.flushCandidatesLog ?? this.logItem.child("flush candidate queue");
        log.refDetached(this.flushCandidatesLog);
        const {flushCandidatesLog} = this;
        // MSC2746 recommends these values (can be quite long when calling because the
        // callee will need a while to answer the call)
        try { await this.delay(this.direction === CallDirection.Inbound ? 500 : 2000); }
        catch (err) { return; }
        this.sendCandidateQueue(flushCandidatesLog);
        this.flushCandidatesLog = undefined;
    }

    private async sendCandidateQueue(log: ILogItem): Promise<void> {
        if (this.candidateSendQueue.length === 0 || this._state === CallState.Ended) {
            return;
        }
        const candidates = this.candidateSendQueue;
        this.candidateSendQueue = [];
        return log.wrap({l: "send candidates", size: candidates.length}, async log => {
            try {
                await this.sendSignallingMessage({
                    type: EventType.Candidates,
                    content: {
                        call_id: this.callId,
                        version: 1,
                        candidates
                    },
                }, log);
                // Try to send candidates again just in case we received more candidates while sending.
                await this.sendCandidateQueue(log);
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
            let logItem;
            if (
                (candidate.sdpMid === null || candidate.sdpMid === undefined) &&
                (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined)
            ) {
                logItem = log.log(`Got remote end-of-ICE candidates`);
            }
            else {
                logItem = log.log(`Adding remote ICE ${candidate.sdpMid} candidate: ${candidate.candidate}`);
            }
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                if (!this.ignoreOffer) {
                    logItem.catch(err);
                }
            }
        }
    }

    private onIceConnectionStateChange = async (state: RTCIceConnectionState, log: ILogItem): Promise<void> => {
        if (this._state === CallState.Ended) {
            return; // because ICE can still complete as we're ending the call
        }
        let logStats = false;
        // ideally we'd consider the call to be connected when we get media but
        // chrome doesn't implement any of the 'onstarted' events yet
        if (state == 'connected') {
            this.iceDisconnectedTimeout?.abort();
            this.iceDisconnectedTimeout = undefined;
            this.setState(CallState.Connected, log);
        } else if (state == 'failed') {
            logStats = true;
            this.iceDisconnectedTimeout?.abort();
            this.iceDisconnectedTimeout = undefined;
            await this._hangup(CallErrorCode.IceFailed, log);
        } else if (state == 'disconnected') {
            logStats = true;
            this.iceDisconnectedTimeout = this.options.createTimeout(30 * 1000);
            try {
                await this.iceDisconnectedTimeout.elapsed()
                await this._hangup(CallErrorCode.IceFailed, log);
            }
            catch (e){
                if (!(e instanceof AbortError)) {
                    throw e; 
                }
            }
        }
        if (logStats) {
            const stats = await this.peerConnection.getStats();
            const statsObj = {};
            stats.forEach((value, key) => {
                statsObj[key] = value;
            });
            log.set("peerConnectionStats", statsObj);
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
            this.options.emitUpdate(this, undefined, log);
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

        // TODO: change signalingState to connectionState?
        if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
            this.peerConnection.close();
        }
    }

    private getSDPMetadata(): SDPStreamMetadata {
        const metadata = {};
        if (this.localMedia?.userMedia) {
            const streamId = this.localMedia.userMedia.id;
            metadata[streamId] = {
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audio_muted: this.localMuteSettings?.microphone ?? false,
                video_muted: this.localMuteSettings?.camera ?? false,
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

    private findReceiverForStream(kind: TrackKind, streamId: string): Receiver | undefined {
        return this.peerConnection.getReceivers().find(r => {
            return r.track.kind === kind && this._remoteTrackToStreamId.get(r.track.id) === streamId;
        });
    }

    private findTransceiverForTrack(track: Track): Transceiver | undefined {
        return this.peerConnection.getTransceivers().find(t => {
            return t.sender.track?.id === track.id;
        });
    }


    private onRemoteTrack(track: Track, streams: ReadonlyArray<Stream>, log: ILogItem) {
        log.set("kind", track.kind);
        log.set("id", track.id);
        log.set("streams", streams.map(s => s.id));
        if (streams.length === 0) {
            log.log({l: `ignoring ${track.kind} streamless track`, id: track.id});
            return;
        }
        const stream = streams[0];
        this._remoteTrackToStreamId.set(track.id, stream.id);
        if (!this._remoteStreams.has(stream.id)) {
            const listener = (event: StreamTrackEvent): void => {
                this.logItem.wrap({l: "removetrack", id: event.track.id}, log => {
                    const streamId = this._remoteTrackToStreamId.get(event.track.id);
                    if (streamId) {
                        this._remoteTrackToStreamId.delete(event.track.id);
                        const streamDetails = this._remoteStreams.get(streamId);
                        if (streamDetails && streamDetails.stream.getTracks().length === 0) {
                            this.disposables.disposeTracked(disposeListener);
                            this._remoteStreams.delete(stream.id);
                            this.updateRemoteMedia(log);
                        }
                    }
                });
            };
            stream.addEventListener("removetrack", listener);
            const disposeListener = () => {
                stream.removeEventListener("removetrack", listener);
            };
            this.disposables.track(disposeListener);
            this._remoteStreams.set(stream.id, {
                disposeListener,
                stream
            });
        }
        this.updateRemoteMedia(log);
    }

    private updateRemoteMedia(log: ILogItem): void {
        log.wrap("reevaluating remote media", log => {
            this._remoteMedia.userMedia = undefined;
            this._remoteMedia.screenShare = undefined;
            if (this.remoteSDPStreamMetadata) {
                for (const streamDetails of this._remoteStreams.values()) {
                    const {stream} = streamDetails;
                    const metaData = this.remoteSDPStreamMetadata[stream.id];
                    if (metaData) {
                        if (metaData.purpose === SDPStreamMetadataPurpose.Usermedia) {
                            this._remoteMedia.userMedia = stream;
                            const audioReceiver = this.findReceiverForStream(TrackKind.Audio, stream.id);
                            if (audioReceiver) {
                                audioReceiver.track.enabled = !metaData.audio_muted;
                            }
                            const videoReceiver = this.findReceiverForStream(TrackKind.Video, stream.id);
                            if (videoReceiver) {
                                videoReceiver.track.enabled = !metaData.video_muted;
                            }
                            this._remoteMuteSettings = new MuteSettings(
                                metaData.audio_muted ?? false,
                                metaData.video_muted ?? false,
                                !!audioReceiver?.track ?? false,
                                !!videoReceiver?.track ?? false
                            );
                            log.log({
                                l: "setting userMedia",
                                micMuted: this._remoteMuteSettings.microphone,
                                cameraMuted: this._remoteMuteSettings.camera
                            });
                        } else if (metaData.purpose === SDPStreamMetadataPurpose.Screenshare) {
                            this._remoteMedia.screenShare = stream;
                            log.log("setting screenShare");
                        }
                    } else {
                        log.log({l: "no metadata yet for stream, ignoring for now", id: stream.id});
                    }
                }
            }
            this.options.emitUpdate(this, undefined, log);
        });
    }

    private updateLocalMedia(localMedia: LocalMedia, logItem: ILogItem): Promise<void> {
        return logItem.wrap("updateLocalMedia", async log => {
            const senders = this.peerConnection.getSenders();
            const applyStream = async (oldStream: Stream | undefined, stream: Stream | undefined, streamPurpose: SDPStreamMetadataPurpose) => {
                const applyTrack = async (oldTrack: Track | undefined, newTrack: Track | undefined) => {
                    const oldSender = senders.find(s => s.track === oldTrack);
                    const streamToKeep = (oldStream ?? stream)!;
                    if (streamToKeep !== stream) {
                        if (oldTrack) {
                            streamToKeep.removeTrack(oldTrack);
                            oldTrack.stop();
                        }
                        if (newTrack) {
                            streamToKeep.addTrack(newTrack);
                        }
                    }
                    if (newTrack && oldSender) {
                        try {
                            await log.wrap(`attempting to replace ${streamPurpose} ${newTrack.kind} track`, log => {
                                return oldSender.replaceTrack(newTrack);
                            });
                            // replaceTrack succeeded, nothing left to do
                            return;
                        } catch (err) {}
                    }
                    if(oldSender) {
                        log.wrap(`removing ${streamPurpose} ${oldSender.track!.kind} track`, log => {
                            this.peerConnection.removeTrack(oldSender);
                        });
                    }
                    if (newTrack) {
                        log.wrap(`adding ${streamPurpose} ${newTrack.kind} track`, log => {
                            const newSender = this.peerConnection.addTrack(newTrack, streamToKeep);
                            this.options.webRTC.prepareSenderForPurpose(this.peerConnection, newSender, streamPurpose);
                        });
                    }
                }
                if (!oldStream && !stream) {
                    return;
                }
                await applyTrack(getStreamAudioTrack(oldStream), getStreamAudioTrack(stream));
                await applyTrack(getStreamVideoTrack(oldStream), getStreamVideoTrack(stream));
            };

            await applyStream(this.localMedia?.userMedia, localMedia?.userMedia, SDPStreamMetadataPurpose.Usermedia);
            await applyStream(this.localMedia?.screenShare, localMedia?.screenShare, SDPStreamMetadataPurpose.Screenshare);
            // we explicitly don't replace this.localMedia if already set
            // as we need to keep the old stream so the stream id doesn't change
            // instead we add and remove tracks in the stream in applyTrack
            if (!this.localMedia) {
                this.localMedia = localMedia;
            }
            // TODO: datachannel, but don't do it here as we don't want to do it from answer, rather in different method
        });
    }

    private async delay(timeoutMs: number): Promise<void> {
        // Allow a short time for initial candidates to be gathered
        const timeout = this.disposables.track(this.options.createTimeout(timeoutMs));
        try {
            await timeout.elapsed();
        } finally {
            this.disposables.untrack(timeout);
        }
    }

    private sendSignallingMessage(message: SignallingMessage<MCallBase>, log: ILogItem) {
        return log.wrap({l: "send", id: message.type}, async log => {
            return this.options.sendSignallingMessage(message, log);
        });
    }

    public dispose(): void {
        this.disposables.dispose();
        this.iceDisconnectedTimeout?.abort();
        this.peerConnection.close();
        // replace emitUpdate in case any eventhandler in here is still attached
        // we really don't want to trigger any code in Member after this
        this.options.emitUpdate = (_, __, log) => {
            log.log("emitting update from PeerCall after disposal", this.logItem.level.Error);
            console.trace("emitting update from PeerCall after disposal");
        };
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
    Ending = 'ending',
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

function enableSenderOnTransceiver(transceiver: Transceiver, enabled: boolean) {
    return enableTransceiver(transceiver, enabled, "sendonly", "recvonly");
}

function enableTransceiver(transceiver: Transceiver, enabled: boolean, exclusiveValue: TransceiverDirection, excludedValue: TransceiverDirection) {
    if (enabled) {
        if (transceiver.direction === "inactive") {
            transceiver.direction = exclusiveValue;
        } else {
            transceiver.direction = "sendrecv";
        }
    } else {
        if (transceiver.direction === "sendrecv") {
            transceiver.direction = excludedValue;
        } else {
            transceiver.direction = "inactive";
        }
    }
}

/**
 * tests to write:
 * 
 * upgradeCall: adding a track with setMedia calls the correct methods on the peerConnection
 * upgradeCall: removing a track with setMedia calls the correct methods on the peerConnection
 * upgradeCall: replacing compatible track with setMedia calls the correct methods on the peerConnection
 * upgradeCall: replacing incompatible track (sender.replaceTrack throws) with setMedia calls the correct methods on the peerConnection
 * 
 * */
