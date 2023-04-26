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

import {PeerCall, CallState, IncomingMessageAction} from "../PeerCall";
import {makeTxnId, makeId} from "../../common";
import {EventType, CallErrorCode} from "../callEventTypes";
import {formatToDeviceMessagesPayload} from "../../common";
import {sortedIndex} from "../../../utils/sortedIndex";
import { ErrorBoundary } from "../../../utils/ErrorBoundary";

import {MuteSettings} from "../common";
import type {Options as PeerCallOptions, RemoteMedia} from "../PeerCall";
import type {LocalMedia} from "../LocalMedia";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {MCallBase, MGroupCallBase, SignallingMessage, CallDeviceMembership} from "../callEventTypes";
import type {GroupCall} from "./GroupCall";
import {RoomMember} from "../../room/members/RoomMember";
import type {EncryptedMessage} from "../../e2ee/olm/Encryption";
import type {ILogItem} from "../../../logging/types";
import type {BaseObservableValue} from "../../../observable/value";
import type {Clock, Timeout} from "../../../platform/web/dom/Clock";

export type Options = Omit<PeerCallOptions, "emitUpdate" | "sendSignallingMessage" | "turnServer"> & {
    confId: string,
    ownUserId: string,
    ownDeviceId: string,
    // local session id of our client
    sessionId: string,
    hsApi: HomeServerApi,
    encryptDeviceMessage: (userId: string, deviceId: string, message: SignallingMessage<MGroupCallBase>, log: ILogItem) => Promise<EncryptedMessage | undefined>,
    emitUpdate: (participant: Member, params?: any) => void,
    clock: Clock
}

const errorCodesWithoutRetry = [
    CallErrorCode.UserHangup,
    CallErrorCode.AnsweredElsewhere,
    CallErrorCode.Replaced,
    CallErrorCode.UserBusy,
    CallErrorCode.Transfered,
    CallErrorCode.NewSession
];

/** @internal */
class MemberConnection {
    public retryCount: number = 0;
    public peerCall?: PeerCall;
    public lastProcessedSeqNr: number | undefined;
    // XXX: Not needed anymore when seq is scoped to call_id
    // see https://github.com/matrix-org/matrix-spec-proposals/pull/3401#discussion_r1097482166
    public lastIgnoredSeqNr: number | undefined;
    public queuedSignallingMessages: SignallingMessage<MGroupCallBase>[] = [];
    public outboundSeqCounter: number = 0;

    constructor(
        public localMedia: LocalMedia,
        public localMuteSettings: MuteSettings,
        public turnServer: BaseObservableValue<RTCIceServer>,
        public readonly logItem: ILogItem
    ) {}

    get canDequeueNextSignallingMessage() {
        if (this.queuedSignallingMessages.length === 0) {
            return false;
        }
        const first = this.queuedSignallingMessages[0];
        const firstSeq = first.content.seq;
        // prevent not being able to jump over seq values of ignored messages for other call ids
        // as they don't increase lastProcessedSeqNr.
        if (this.lastIgnoredSeqNr !== undefined && firstSeq === this.lastIgnoredSeqNr + 1) {
            return true;
        }
        if (this.lastProcessedSeqNr === undefined) {
            return firstSeq === 0;
        }
        // allow messages with both a seq we've just seen and
        // the next one to be dequeued as it can happen
        // that messages for other callIds (which could repeat seq)
        // are present in the queue
        // XXX: Not needed anymore when seq is scoped to call_id
        // see https://github.com/matrix-org/matrix-spec-proposals/pull/3401#discussion_r1097482166
        return firstSeq <= (this.lastProcessedSeqNr + 1);
    }

    dispose() {
        this.peerCall?.dispose();
        this.localMedia.dispose();
        this.logItem.finish();
    }
}

export class Member {
    private connection?: MemberConnection;
    private expireTimeout?: Timeout;
    private errorBoundary = new ErrorBoundary(err => {
        this.options.emitUpdate(this, "error");
        if (this.connection) {
            // in case the error happens in code that does not log,
            // log it here to make sure it isn't swallowed
            this.connection.logItem.log("error at boundary").catch(err);
        }
    });

    constructor(
        public member: RoomMember,
        private callDeviceMembership: CallDeviceMembership,
        private options: Options,
        updateMemberLog: ILogItem
    ) {
        this._renewExpireTimeout(updateMemberLog);
    }

    get error(): Error | undefined {
        return this.errorBoundary.error;
    }

    get usesFoci(): boolean {
        const activeFoci = this.callDeviceMembership["m.foci.active"];
        return Array.isArray(activeFoci) && activeFoci.length > 0;
    }

    private _renewExpireTimeout(log: ILogItem) {
        this.expireTimeout?.dispose();
        this.expireTimeout = undefined;
        const expiresAt = memberExpiresAt(this.callDeviceMembership);
        if (typeof expiresAt !== "number") {
            return;
        }
        const expiresFromNow = Math.max(0, expiresAt - this.options.clock.now());
        log?.set("expiresIn", expiresFromNow);
        // add 10ms to make sure isExpired returns true
        this.expireTimeout = this.options.clock.createTimeout(expiresFromNow + 10);
        this.expireTimeout.elapsed().then(
            () => { this.options.emitUpdate(this, "isExpired"); },
            (err) => { /* ignore abort error */ },
        );
    }

    /**
     * Gives access the log item for this item once joined to the group call.
     * The signalling for this member will be log in this item.
     * Can be used for call diagnostics while in the call.
     **/
    get logItem(): ILogItem | undefined {
        return this.connection?.logItem;
    }

    get remoteMedia(): RemoteMedia | undefined {
        return this.connection?.peerCall?.remoteMedia;
    }

    get isExpired(): boolean {
        // never consider a peer we're connected to, to be expired
        return !this.isConnected && isMemberExpired(this.callDeviceMembership, this.options.clock.now());
    }

    get remoteMuteSettings(): MuteSettings | undefined {
        return this.connection?.peerCall?.remoteMuteSettings;
    }

    get isConnected(): boolean {
        return this.connection?.peerCall?.state === CallState.Connected;
    }

    get userId(): string {
        return this.member.userId;
    }

    get deviceId(): string {
        return this.callDeviceMembership.device_id;
    }

    /** @internal, to emulate deviceKey properties when calling formatToDeviceMessagesPayload */   
    get user_id(): string {
        return this.userId;
    }
    
    /** @internal, to emulate deviceKey properties when calling formatToDeviceMessagesPayload */
    get device_id(): string {
        return this.deviceId;
    }

    /** session id of the member */
    get sessionId(): string {
        return this.callDeviceMembership.session_id;
    }

    get dataChannel(): any | undefined {
        return this.connection?.peerCall?.dataChannel;
    }

    /** @internal */
    connect(localMedia: LocalMedia, localMuteSettings: MuteSettings, turnServer: BaseObservableValue<RTCIceServer>, memberLogItem: ILogItem): Promise<ILogItem | undefined> | undefined {
        return this.errorBoundary.try(async () => {
            if (this.connection) {
                return;
            }
            // Safari can't send a MediaStream to multiple sources, so clone it
            const connection = new MemberConnection(
                localMedia.clone(),
                localMuteSettings,
                turnServer,
                memberLogItem
            );
            this.connection = connection;
            let connectLogItem: ILogItem | undefined;
            await connection.logItem.wrap("connect", async log => {
                connectLogItem = log;
                await this.callIfNeeded(log);
            });
            return connectLogItem;
        });
    }

    private callIfNeeded(log: ILogItem): Promise<void> {
        return log.wrap("callIfNeeded", async log => {
            // otherwise wait for it to connect
            let shouldInitiateCall;
            // the lexicographically lower side initiates the call
            if (this.member.userId === this.options.ownUserId) {
                shouldInitiateCall = this.deviceId > this.options.ownDeviceId;
            } else {
                shouldInitiateCall = this.member.userId > this.options.ownUserId;
            }
            if (shouldInitiateCall) {
                const connection = this.connection!;
                connection.peerCall = this._createPeerCall(makeId("c"));
                await connection.peerCall.call(
                    connection.localMedia,
                    connection.localMuteSettings,
                    log
                );
            } else {
                log.set("wait_for_invite", true);
            }
        });
    }

    /** @internal */
    disconnect(hangup: boolean): Promise<ILogItem | undefined> | undefined {
        return this.errorBoundary.try(async () => {
            const {connection} = this;
            if (!connection) {
                return;
            }
            let disconnectLogItem: ILogItem | undefined;
            // if if not sending the hangup, still log disconnect
            await connection.logItem.wrap("disconnect", async log => {
                disconnectLogItem = log;
                if (hangup && connection.peerCall) {
                    await connection.peerCall.hangup(CallErrorCode.UserHangup, log);
                }
            });
            connection.dispose();
            this.connection = undefined;
            return disconnectLogItem;
        });
    }

    /** @internal */
    updateCallInfo(callDeviceMembership: CallDeviceMembership, causeItem: ILogItem) {
        this.errorBoundary.try(() => {
            this.callDeviceMembership = callDeviceMembership;
            this._renewExpireTimeout(causeItem);
            if (this.connection) {
                this.connection.logItem.refDetached(causeItem);
            }
        });
    }
    
    /** @internal */
    updateRoomMember(roomMember: RoomMember) {
        this.member = roomMember;
        // TODO: this emits an update during the writeSync phase, which we usually try to avoid
        this.options.emitUpdate(this);
    }

    /** @internal */
    emitUpdateFromPeerCall = async (peerCall: PeerCall, params: any, log: ILogItem): Promise<void> => {
        const connection = this.connection!;
        if (peerCall.state === CallState.Ringing) {
            connection.logItem.wrap("ringing, answer peercall", answerLog => {
                log.refDetached(answerLog);
                return peerCall.answer(connection.localMedia, connection.localMuteSettings, answerLog);
            });
        }
        else if (peerCall.state === CallState.Ended) {
            const hangupReason = peerCall.hangupReason;
            peerCall.dispose();
            connection.peerCall = undefined;
            if (hangupReason && !errorCodesWithoutRetry.includes(hangupReason)) {
                connection.retryCount += 1;
                const {retryCount} = connection;
                await connection.logItem.wrap({l: "retry connection", retryCount}, async retryLog => {
                    log.refDetached(retryLog);
                    if (retryCount <= 3) {
                        await this.callIfNeeded(retryLog);
                    } else {
                        const disconnectLogItem = await this.disconnect(false);
                        if (disconnectLogItem) {
                            retryLog.refDetached(disconnectLogItem);
                        }
                    }
                });
            }
        }
        this.options.emitUpdate(this, params);
    }

    /** @internal */
    sendSignallingMessage = async (message: SignallingMessage<MCallBase>, log: ILogItem): Promise<void> => {
        const groupMessage = message as SignallingMessage<MGroupCallBase>;
        groupMessage.content.seq = this.connection!.outboundSeqCounter++;
        groupMessage.content.conf_id = this.options.confId;
        groupMessage.content.device_id = this.options.ownDeviceId;
        groupMessage.content.party_id = this.options.ownDeviceId;
        groupMessage.content.sender_session_id = this.options.sessionId;
        groupMessage.content.dest_session_id = this.sessionId;
        let payload;
        let type: string = message.type;
        const encryptedMessages = await this.options.encryptDeviceMessage(this.member.userId, this.deviceId, groupMessage, log);
        if (encryptedMessages) {
            payload = formatToDeviceMessagesPayload(encryptedMessages);
            type = "m.room.encrypted";
        } else {
            // device needs deviceId and userId
            payload = formatToDeviceMessagesPayload([{content: groupMessage.content, device: this}]);
        }
        // TODO: remove this for release
        log.set("payload", groupMessage.content);
        const request = this.options.hsApi.sendToDevice(
            type,
            payload,
            makeTxnId(),
            {log}
        );
        await request.response();
    }

    /** @internal */
    handleDeviceMessage(message: SignallingMessage<MGroupCallBase>, syncLog: ILogItem): void {
        this.errorBoundary.try(() => {
            syncLog.wrap({l: "Member.handleDeviceMessage", type: message.type, seq: message.content?.seq}, log => {
                const {connection} = this;
                if (connection) {
                    const destSessionId = message.content.dest_session_id;
                    if (destSessionId !== this.options.sessionId) {
                        const logItem = connection.logItem.log({l: "ignoring to_device event with wrong session_id", destSessionId, type: message.type});
                        log.refDetached(logItem);
                        return;
                    }
                    // if there is no peerCall, we either create it with an invite and Handle is implied or we'll ignore it 
                    if (connection.peerCall) {
                        const action = connection.peerCall.getMessageAction(message);
                        // deal with glare and replacing the call before creating new calls
                        if (action === IncomingMessageAction.InviteGlare) {
                            const {shouldReplace, log} = connection.peerCall.handleInviteGlare(message, this.deviceId, connection.logItem);
                            if (log) {
                                log.refDetached(log);
                            }
                            if (shouldReplace) {
                                connection.peerCall.dispose();
                                connection.peerCall = undefined;
                            }
                        }
                    }
                    // create call on invite
                    if (message.type === EventType.Invite && !connection.peerCall) {
                        connection.peerCall = this._createPeerCall(message.content.call_id);
                    }
                    // enqueue
                    const idx = sortedIndex(connection.queuedSignallingMessages, message, (a, b) => a.content.seq - b.content.seq);
                    connection.queuedSignallingMessages.splice(idx, 0, message);
                    // dequeue as much as we can
                    let hasNewMessageBeenDequeued = false;
                    if (connection.peerCall) {
                        hasNewMessageBeenDequeued = this.dequeueSignallingMessages(connection, connection.peerCall, message, log);
                    }
                    if (!hasNewMessageBeenDequeued) {
                        log.refDetached(connection.logItem.log({l: "queued message", type: message.type, seq: message.content.seq, idx}));
                    }
                } else {
                    // TODO: the right thing to do here would be to at least enqueue the message rather than drop it,
                    // and if it's up to the other end to send the invite and the type is an invite to actually
                    // call connect and assume the m.call.member state update is on its way?
                    syncLog.log({l: "member not connected", userId: this.userId, deviceId: this.deviceId});
                }
            });
        });
    }

    private dequeueSignallingMessages(connection: MemberConnection, peerCall: PeerCall, newMessage: SignallingMessage<MGroupCallBase>, syncLog: ILogItem): boolean {
        let hasNewMessageBeenDequeued = false;
        while (connection.canDequeueNextSignallingMessage) {
            const message = connection.queuedSignallingMessages.shift()!;
            const isNewMsg = message === newMessage;
            hasNewMessageBeenDequeued = hasNewMessageBeenDequeued || isNewMsg;
            syncLog.wrap(isNewMsg ? "process message" : "dequeue message", log => {
                const seq = message.content?.seq;
                log.set("seq", seq);
                log.set("type", message.type);
                // ignore items in the queue that should not be handled and prevent
                // the lastProcessedSeqNr being corrupted with the `seq` for other call ids
                // XXX: Not needed anymore when seq is scoped to call_id
                // see https://github.com/matrix-org/matrix-spec-proposals/pull/3401#discussion_r1097482166
                const action = peerCall.getMessageAction(message);
                if (action === IncomingMessageAction.Handle) {
                    const item = peerCall.handleIncomingSignallingMessage(message, this.deviceId, connection.logItem);
                    log.refDetached(item);
                    connection.lastProcessedSeqNr = seq;
                } else {
                    log.set("ignored", true);
                    connection.lastIgnoredSeqNr = seq;
                }
            });
        }
        return hasNewMessageBeenDequeued;
    }

    /** @internal */
    async setMedia(localMedia: LocalMedia, previousMedia: LocalMedia): Promise<void> {
        return this.errorBoundary.try(async () => {
            const {connection} = this;
            if (connection) {
                connection.localMedia = localMedia.replaceClone(connection.localMedia, previousMedia);
                await connection.peerCall?.setMedia(connection.localMedia, connection.logItem);
            }
        });
    }

    async setMuted(muteSettings: MuteSettings): Promise<void> {
        return this.errorBoundary.try(async () => {
            const {connection} = this;
            if (connection) {
                connection.localMuteSettings = muteSettings;
                await connection.peerCall?.setMuted(muteSettings, connection.logItem);
            }
        });
    }

    private _createPeerCall(callId: string): PeerCall {
        const connection = this.connection!;
        return new PeerCall(callId, Object.assign({}, this.options, {
            errorBoundary: this.errorBoundary,
            emitUpdate: this.emitUpdateFromPeerCall,
            sendSignallingMessage: this.sendSignallingMessage,
            turnServer: connection.turnServer
        }), connection.logItem);
    }

    dispose() {
        this.connection?.dispose();
        this.connection = undefined;
        this.expireTimeout?.dispose();
        this.expireTimeout = undefined;
        // ensure the emitUpdate callback can't be called anymore
        this.options.emitUpdate = () => {};
    }
}

export function memberExpiresAt(callDeviceMembership: CallDeviceMembership): number | undefined {
    const expiresAt = callDeviceMembership["expires_ts"];
    if (Number.isSafeInteger(expiresAt)) {
        return expiresAt;
    }
}

export function isMemberExpired(callDeviceMembership: CallDeviceMembership, now: number, margin: number = 0) {
    const expiresAt = memberExpiresAt(callDeviceMembership);
    return typeof expiresAt === "number" ? ((expiresAt + margin) <= now) : true;
}

import {ObservableValue} from "../../../observable/value";
import {Clock as MockClock} from "../../../mocks/Clock";
import {Instance as NullLoggerInstance} from "../../../logging/NullLogger";

export function tests() {
    
    class MockMedia {
        clone(): MockMedia { return this; }
    }

    class MockPeerConn {
        addEventListener() {}
        removeEventListener() {}
        setConfiguration() {}
        setRemoteDescription() {}
        getReceivers() { return [{}]; } // non-empty array
        getSenders() { return []; }
        addTrack() { return {}; }
        removeTrack() {}
        close() {}
    }
    return {
        "test queue doesn't get blocked by enqueued, then ignored device message": assert => {
            // XXX we might want to refactor the queue code a bit so it's easier to test
            // without having to provide so many mocks
            const clock = new MockClock();
            // setup logging
            const logger = NullLoggerInstance;
            // const logger = new Logger({platform: {clock, random: Math.random}});
            // logger.addReporter(new ConsoleReporter());
            
            // create member
            const callDeviceMembership = {
                ["device_id"]: "BVPIHSKXFC",
                ["session_id"]: "s1d5863f41ec5a5",
                ["expires_ts"]: 123,
                feeds: [{purpose: "m.usermedia"}]
            };
            const roomMember = RoomMember.fromUserId("!abc", "@bruno4:matrix.org", "join");
            const turnServer = new ObservableValue({}) as ObservableValue<RTCIceServer>;
            // @ts-ignore
            const options = {
                confId: "conf",
                ownUserId: "@foobaraccount2:matrix.org",
                ownDeviceId: "CMLEZSARRT",
                sessionId: "s1cece7088b9d35",
                clock,
                emitUpdate: () => {},
                webRTC: {
                    prepareSenderForPurpose: () => {},
                    createPeerConnection() {
                        return new MockPeerConn();
                    }
                }
            } as Options;
            const member = new Member(roomMember, callDeviceMembership, options, logger.child("member"));
            member.connect(new MockMedia() as LocalMedia, new MuteSettings(), turnServer, logger.child("connect"));
            // pretend we've already received 3 messages
            // @ts-ignore
            member.connection!.lastProcessedSeqNr = 2;
            // send hangup with seq=3, this will enqueue the message because there is no peerCall
            // as it's up to @bruno4:matrix.org to send the invite
            const hangup = {
                type: EventType.Hangup,
                content: {
                  "call_id": "c0ac1b0e37afe73",
                  "version": 1,
                  "reason": "invite_timeout",
                  "seq": 3,
                  "conf_id": "conf-16a120796440a6",
                  "device_id": "BVPIHSKXFC",
                  "party_id": "BVPIHSKXFC",
                  "sender_session_id": "s1d5863f41ec5a5",
                  "dest_session_id": "s1cece7088b9d35"
                }
            } as SignallingMessage<MGroupCallBase>;
            member.handleDeviceMessage(hangup, logger.child("handle hangup"));
            // Send an invite with seq=4, this will create a new peer call with a the call id
            // when dequeueing the hangup from before, it'll get ignored because it is
            // for the previous call id.
            const invite = {
                type: EventType.Invite,
                content: {
                  "call_id": "c1175b12d559fb1",
                  "offer": {
                    "type": "offer",
                    "sdp": "..."
                  },
                  "org.matrix.msc3077.sdp_stream_metadata": {
                    "60087b60-487e-4fa0-8229-b232c18e1332": {
                      "purpose": "m.usermedia",
                      "audio_muted": false,
                      "video_muted": false
                    }
                  },
                  "version": 1,
                  "lifetime": 60000,
                  "seq": 4,
                  "conf_id": "conf-16a120796440a6",
                  "device_id": "BVPIHSKXFC",
                  "party_id": "BVPIHSKXFC",
                  "sender_session_id": "s1d5863f41ec5a5",
                  "dest_session_id": "s1cece7088b9d35"
                }
            } as SignallingMessage<MGroupCallBase>;
            member.handleDeviceMessage(invite, logger.child("handle invite"));
            // @ts-ignore
            assert.equal(member.connection!.queuedSignallingMessages.length, 0);
            // logger.reporters[0].printOpenItems();
        }
    };
}
