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

import type {MuteSettings} from "../common";
import type {Options as PeerCallOptions, RemoteMedia} from "../PeerCall";
import type {LocalMedia} from "../LocalMedia";
import type {HomeServerApi} from "../../net/HomeServerApi";
import type {MCallBase, MGroupCallBase, SignallingMessage, CallDeviceMembership} from "../callEventTypes";
import type {GroupCall} from "./GroupCall";
import type {RoomMember} from "../../room/members/RoomMember";
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
        if (this.lastProcessedSeqNr === undefined) {
            return true;
        }
        const first = this.queuedSignallingMessages[0];
        // allow messages with both a seq we've just seen and
        // the next one to be dequeued as it can happen
        // that messages for other callIds (which could repeat seq)
        // are present in the queue
        return first.content.seq === this.lastProcessedSeqNr ||
            first.content.seq === this.lastProcessedSeqNr + 1;
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
            const {connection} = this;
            if (connection) {
                const destSessionId = message.content.dest_session_id;
                if (destSessionId !== this.options.sessionId) {
                    const logItem = connection.logItem.log({l: "ignoring to_device event with wrong session_id", destSessionId, type: message.type});
                    syncLog.refDetached(logItem);
                    return;
                }
                // if there is no peerCall, we either create it with an invite and Handle is implied or we'll ignore it 
                let action = IncomingMessageAction.Handle;
                if (connection.peerCall) {
                    action = connection.peerCall.getMessageAction(message);
                    // deal with glare and replacing the call before creating new calls
                    if (action === IncomingMessageAction.InviteGlare) {
                        const {shouldReplace, log} = connection.peerCall.handleInviteGlare(message, this.deviceId, connection.logItem);
                        if (log) {
                            syncLog.refDetached(log);
                        }
                        if (shouldReplace) {
                            connection.peerCall = undefined;
                            action = IncomingMessageAction.Handle;
                        }
                    }
                }
                if (message.type === EventType.Invite && !connection.peerCall) {
                    connection.peerCall = this._createPeerCall(message.content.call_id);
                }
                if (action === IncomingMessageAction.Handle) {
                    const idx = sortedIndex(connection.queuedSignallingMessages, message, (a, b) => a.content.seq - b.content.seq);
                    connection.queuedSignallingMessages.splice(idx, 0, message);
                    if (connection.peerCall) {
                        const hasNewMessageBeenDequeued = this.dequeueSignallingMessages(connection, connection.peerCall, message, syncLog);
                        if (!hasNewMessageBeenDequeued) {
                            syncLog.refDetached(connection.logItem.log({l: "queued signalling message", type: message.type, seq: message.content.seq}));
                        }
                    }
                } else if (action === IncomingMessageAction.Ignore && connection.peerCall) {
                    const logItem = connection.logItem.log({l: "ignoring to_device event with wrong call_id", callId: message.content.call_id, type: message.type});
                    syncLog.refDetached(logItem);
                }
            } else {
                syncLog.log({l: "member not connected", userId: this.userId, deviceId: this.deviceId});
            }
        });
    }

    private dequeueSignallingMessages(connection: MemberConnection, peerCall: PeerCall, newMessage: SignallingMessage<MGroupCallBase>, syncLog: ILogItem): boolean {
        let hasNewMessageBeenDequeued = false;
        while (connection.canDequeueNextSignallingMessage) {
            const message = connection.queuedSignallingMessages.shift()!;
            if (message === newMessage) {
                hasNewMessageBeenDequeued = true;
            }
            // ignore items in the queue that should not be handled and prevent
            // the lastProcessedSeqNr being corrupted with the `seq` for other call ids
            if (peerCall.getMessageAction(message) === IncomingMessageAction.Handle) {
                const item = peerCall.handleIncomingSignallingMessage(message, this.deviceId, connection.logItem);
                syncLog.refDetached(item);
                connection.lastProcessedSeqNr = message.content.seq;
            }
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
        this.options = undefined as any as Options;
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
